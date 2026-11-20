/* Prüft Berechnungsregeln und Datenmodell. Ausführen: node --test tests/ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Browser-Skripte in einem gemeinsamen Kontext laden (wie im <script>-Tag).
const src = ["config.js", "data.js", "metrics.js"]
  .map((f) => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8").replace(/if \(typeof module[\s\S]*?\n}\n/, ""))
  .join("\n");
const ctx = vm.createContext({ console });
const M = vm.runInContext(
  src +
    "\n;({ largestRemainder, distribution, applyFilters, starDist, itemDist, compareDist, serviceTable, themeCounts, matchThemes, praiseComments, monthlySeries, normalizeRow, parseScaleValue, importCsv, buildPeriods, SAMPLE_RECORDS, ITEMS, STAR_SCALE, AGREE_SCALE, CATALOG, SERVICE_TO_OFFICE, DATA_END, MIN_N_SHOW })",
  ctx
);

const rec = (stars, items = {}, extra = {}) => ({
  id: String(Math.random()), complete: true, date: new Date(2026, 9, 10), service: "Wohnsitz ummelden", office: "Bürgeramt",
  stars, items: { SQ001: null, SQ002: null, SQ003: null, SQ004: null, SQ005: null, ...items }, textNegative: "", textPositive: "", ...extra,
});

test("Prozentwerte einer Verteilung ergeben genau 100", () => {
  const p = M.largestRemainder([1, 1, 1], 3);
  assert.equal(p.reduce((a, b) => a + b, 0), 100);
  for (const counts of [[3, 7, 11, 40, 39], [1, 0, 0, 0, 2], [5, 5, 5, 5, 6]]) {
    const total = counts.reduce((a, b) => a + b, 0);
    assert.equal(M.largestRemainder(counts, total).reduce((a, b) => a + b, 0), 100);
  }
});

test("Gruppenanteile stimmen mit Einzelverteilung überein; fehlende Werte nicht im Nenner", () => {
  const recs = [rec(5), rec(4), rec(4), rec(3), rec(1), rec(null), rec(null)];
  const d = M.starDist(recs);
  assert.equal(d.valid, 5);
  assert.equal(d.missing, 2);
  assert.equal(d.groups.positive.n, 3);
  assert.equal(d.groups.positive.pct, d.pct[3] + d.pct[4]);
  assert.equal(d.groups.critical.pct, d.pct[0] + d.pct[1]);
  assert.equal(d.groups.positive.pct + d.groups.neutral.pct + d.groups.critical.pct, 100);
  assert.equal(d.mean, (5 + 4 + 4 + 3 + 1) / 5, "fehlende Bewertungen zählen nicht als 0 Sterne");
});

test("Keine Daten ergeben null statt 0", () => {
  const d = M.starDist([rec(null)]);
  assert.equal(d.mean, null);
  assert.equal(d.groups.positive.pct, null);
  assert.equal(d.showable, false);
});

test("Skalenwerte aus verschiedenen Exportformaten", () => {
  assert.equal(M.parseScaleValue("4"), 4);
  assert.equal(M.parseScaleValue("A2"), 2);
  assert.equal(M.parseScaleValue("AO05"), 5);
  assert.equal(M.parseScaleValue("Stimme eher nicht zu"), 2);
  assert.equal(M.parseScaleValue(""), null);
  assert.equal(M.parseScaleValue("0"), null);
  assert.equal(M.parseScaleValue("99"), null);
});

test("Zustimmungs-Items werden über den Feldcode zugeordnet, nicht über die Position", () => {
  const r = M.normalizeRow({ id: "1", submitdate: "2026-10-01 10:00:00", Q00: "Gewerbe anmelden", G01Q02: "4",
    "G02Q03[SQ002]": "2", "G02Q03[SQ003]": "3", "G02Q03[SQ004]": "4", "G02Q03[SQ005]": "5", "G02Q03[SQ001]": "1" });
  assert.equal(JSON.stringify(r.items), JSON.stringify({ SQ002: 2, SQ003: 3, SQ004: 4, SQ005: 5, SQ001: 1 }));
  assert.equal(r.office, "Ordnungsamt");
  assert.equal(M.ITEMS.map((i) => i.code).join(), "SQ002,SQ003,SQ004,SQ005,SQ001");
});

test("Nicht abgeschlossene Fragebögen werden nicht ausgewertet", () => {
  const out = M.applyFilters([rec(5), rec(4, {}, { complete: false })], {});
  assert.equal(out.length, 1);
});

test("Jeder Service gehört genau zu einer Dienststelle", () => {
  const all = M.CATALOG.flatMap((c) => c.services);
  assert.equal(new Set(all).size, all.length);
  for (const r of M.SAMPLE_RECORDS) {
    assert.equal(r.office, M.SERVICE_TO_OFFICE[r.service], `${r.service} → ${r.office}`);
  }
});

test("Dienststellen-Filter liefert nur passende Services", () => {
  for (const c of M.CATALOG) {
    const out = M.applyFilters(M.SAMPLE_RECORDS, { office: c.office });
    assert.ok(out.length > 0);
    assert.ok(out.every((r) => c.services.includes(r.service)));
  }
});

test("Lob-Auswahl enthält nur Kommentare von Personen mit 5 Sternen", () => {
  const p = M.praiseComments(M.SAMPLE_RECORDS.filter((r) => r.complete));
  assert.ok(p.length > 0);
  assert.ok(p.every((r) => r.stars === 5 && r.textPositive));
  for (let i = 1; i < p.length; i++) assert.ok(p[i - 1].date >= p[i].date, "neueste zuerst");
});

test("Themenzuordnung ist stichwortbasiert und nachvollziehbar", () => {
  assert.equal(JSON.stringify(M.matchThemes("Das Hochladen der Datei ging nicht")), JSON.stringify(["upload"]));
  assert.equal(JSON.stringify(M.matchThemes("Insgesamt etwas umständlich.")), JSON.stringify([]));
  const t = M.themeCounts([rec(2, {}, { textNegative: "Upload kaputt" }), rec(1, {}, { textNegative: "umständlich" })]);
  assert.equal(t.totalTexts, 2);
  assert.equal(t.unassigned, 1);
});

test("Zeiträume: Vergleichszeitraum hat gleiche Länge und schließt direkt an", () => {
  const periods = M.buildPeriods(M.DATA_END);
  for (const p of periods) {
    const len = (p.to.getFullYear() - p.from.getFullYear()) * 12 + p.to.getMonth() - p.from.getMonth();
    const plen = (p.prev.to.getFullYear() - p.prev.from.getFullYear()) * 12 + p.prev.to.getMonth() - p.prev.from.getMonth();
    assert.equal(len, plen, p.id);
    assert.equal(new Date(p.prev.to.getTime() + 1000).getDate(), 1, `${p.id}: Vorzeitraum endet am Monatsende`);
    assert.equal(new Date(p.prev.to.getTime() + 1000).getMonth(), p.from.getMonth());
  }
  assert.equal(periods.find((p) => p.id === "q").label.startsWith("3. Quartal 2026"), true);
});

test("CSV-Import mit Spaltenüberschrift „Feldcode. Fragetext“", () => {
  const csv = [
    'id;submitdate. Datum der Abgabe;Q00. Welchen Online-Service haben Sie genutzt?;G01Q02. Wie zufrieden;G02Q03[SQ002]. Schritte;G02Q03[SQ001]. Erledigt;G01Q04. Schlecht;G01Q05. Gut',
    '7;2026-10-02 12:00:00;Fahrzeug zulassen;A2;A4;Stimme voll und ganz zu;"Upload ""hakte""; mehrfach";',
    '8;;Fahrzeug zulassen;;;;;',
    '9;2026-10-03 08:00:00;Unbekannter Dienst;5;;;;Super',
  ].join("\n");
  const res = M.importCsv(csv);
  assert.equal(res.records.length, 3);
  const [a, b, c] = res.records;
  assert.equal(a.stars, 2);
  assert.equal(a.items.SQ002, 4);
  assert.equal(a.items.SQ001, 5);
  assert.equal(a.textNegative, 'Upload "hakte"; mehrfach');
  assert.equal(b.complete, false);
  assert.equal(c.office, "Nicht zugeordnet");
  assert.equal(JSON.stringify(res.unknownServices), JSON.stringify(["Unbekannter Dienst"]));
});

test("Beispieldaten: G01Q04 nur bei weniger als 5 Sternen (Annahme)", () => {
  assert.ok(M.SAMPLE_RECORDS.filter((r) => r.textNegative).every((r) => r.stars != null && r.stars <= 4));
});
