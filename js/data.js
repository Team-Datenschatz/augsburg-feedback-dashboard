/* =====================================================================
   Daten: (1) fiktive Beispieldaten im Format des Fragebogen-Exports,
   (2) Normalisierung in das interne Modell, (3) CSV-Import echter Exporte.
   BEISPIELDATEN: Alle erzeugten Datensätze und Texte sind erfunden und
   enthalten keine personenbezogenen Angaben.
   ===================================================================== */

const SAMPLE_POSITIVE = [
  "Alles war klar strukturiert, ich musste nicht lange suchen.",
  "Ging schnell und ich habe mir den Weg ins Amt gespart.",
  "Die Hinweise zu den Nachweisen waren sehr hilfreich.",
  "Hat auf dem Smartphone problemlos funktioniert.",
  "Verständliche Sprache, keine komplizierten Fachbegriffe.",
  "Die Bestätigung per E-Mail kam sofort.",
  "Einfache Bedienung, auch ohne Vorkenntnisse.",
  "Ich konnte alles abends von zu Hause erledigen – super.",
  "Übersichtliche Schritte und eine klare Zusammenfassung am Ende.",
  "Bezahlung direkt online, sehr praktisch.",
  "Schneller als erwartet, danke an das Team!",
  "Die Statusanzeige hat mir gezeigt, wo ich stehe.",
];

const SAMPLE_NEGATIVE = [
  "Ich bin zweimal aus dem Formular geflogen und musste neu anfangen.",
  "Das Hochladen der Nachweise hat nicht funktioniert, die Datei war angeblich zu groß.",
  "Es war nicht klar, welche Unterlagen ich vorher bereithalten muss.",
  "Viele Begriffe waren unverständlich, typisches Behördendeutsch.",
  "Die Anmeldung mit der BundID hat ewig gedauert.",
  "Auf dem Handy sind die Buttons zu klein.",
  "Nach dem Absenden kam keine Bestätigung, ich weiß nicht, ob es geklappt hat.",
  "Fehlermeldung ohne Erklärung, was ich ändern soll.",
  "Pflichtfelder waren nicht gekennzeichnet.",
  "Die Bezahlung mit Kreditkarte ist abgebrochen.",
  "Die Seite lädt nicht richtig, Ladezeit sehr lang.",
  "Ich musste dasselbe Dokument zweimal hochladen.",
  "Es dauert zu lange, bis man eine Rückmeldung bekommt.",
  "Mir hat ein persönlicher Ansprechpartner gefehlt.",
  "Insgesamt etwas umständlich.",
];

/* Fiktive Qualitätsunterschiede je Service (Verschiebung der Sternebewertung)
   und relative Nutzungshäufigkeit. */
const SAMPLE_SERVICE_PROFILE = {
  "Meldebescheinigung beantragen": { bias: 0.5, weight: 14 },
  "Wohnsitz ummelden": { bias: 0.1, weight: 16 },
  "Führungszeugnis beantragen": { bias: 0.3, weight: 6 },
  "Geburtsurkunde bestellen": { bias: 0.4, weight: 8 },
  "Eheurkunde bestellen": { bias: 0.2, weight: 4 },
  "Sterbeurkunde bestellen": { bias: 0, weight: 0.6 },
  "Fahrzeug zulassen": { bias: -0.6, weight: 12 },
  "Fahrzeug außer Betrieb setzen": { bias: 0.2, weight: 6 },
  "Wunschkennzeichen reservieren": { bias: 0.6, weight: 7 },
  "Bewohnerparkausweis beantragen": { bias: -0.2, weight: 9 },
  "Gewerbe anmelden": { bias: -0.3, weight: 5 },
  "Aufenthaltstitel verlängern": { bias: -0.8, weight: 6 },
  "Verpflichtungserklärung abgeben": { bias: -0.1, weight: 1.5 },
};

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, entries) {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

function clamp5(n) {
  return Math.min(5, Math.max(1, Math.round(n)));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}
function isoDateTime(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/* Erzeugt Zeilen wie im LimeSurvey-Export (Feldcode → Wert). */
function generateSampleExport(seed = 2026) {
  const rng = mulberry32(seed);
  const rows = [];
  const services = Object.entries(SAMPLE_SERVICE_PROFILE).map(([s, p]) => [s, p.weight]);
  let id = 1;
  const months = monthsBetween({ from: DATA_START, to: DATA_END });
  for (let m = 0; m < months; m++) {
    const monthStart = new Date(DATA_START.getFullYear(), DATA_START.getMonth() + m, 1);
    const monthEnd = new Date(DATA_START.getFullYear(), DATA_START.getMonth() + m + 1, 0, 23, 59, 59);
    const trend = (m / months) * 0.35; // leichte fiktive Verbesserung über die Zeit
    const count = 380 + Math.floor(rng() * 140);
    for (let i = 0; i < count; i++) {
      const service = pickWeighted(rng, services);
      const bias = SAMPLE_SERVICE_PROFILE[service].bias + trend;
      const base = 3.6 + bias + (rng() - 0.5) * 4.4;
      const start = new Date(monthStart.getTime() + rng() * (monthEnd - monthStart - 3600e3));
      const durationMin = 2 + Math.floor(rng() * 12);
      const end = new Date(start.getTime() + durationMin * 60e3);
      const completed = rng() > 0.06; // ca. 6 % abgebrochene Fragebögen
      const starsMissing = rng() < 0.03;
      const stars = starsMissing ? null : clamp5(base);
      const row = {
        id: String(id++),
        submitdate: completed ? isoDateTime(end) : "",
        lastpage: completed ? "3" : String(1 + Math.floor(rng() * 2)),
        startlanguage: rng() < 0.93 ? "de" : "en",
        seed: String(Math.floor(rng() * 1e9)),
        startdate: isoDateTime(start),
        datestamp: isoDateTime(end),
        Q00: service,
        G01Q02: stars == null ? "" : String(stars),
      };
      const ref = stars ?? clamp5(base);
      ITEMS.forEach((item, idx) => {
        if (!completed && idx > 1) {
          row[item.field] = "";
          return;
        }
        if (rng() < 0.04) {
          row[item.field] = ""; // keine Angabe
          return;
        }
        const itemBias = { SQ001: 0.3, SQ002: 0.1, SQ003: -0.35, SQ004: -0.1, SQ005: 0.05 }[item.code];
        row[item.field] = String(clamp5(ref + itemBias + (rng() - 0.5) * 2.2));
      });
      // ANNAHME: G01Q04 wird nur bei weniger als 5 Sternen angezeigt.
      row.G01Q04 = completed && stars != null && stars <= 4 && rng() < (stars <= 2 ? 0.75 : stars === 3 ? 0.45 : 0.18)
        ? SAMPLE_NEGATIVE[Math.floor(rng() * SAMPLE_NEGATIVE.length)]
        : "";
      // ANNAHME: G01Q05 wird allen angezeigt und ist freiwillig.
      row.G01Q05 = completed && rng() < (stars === 5 ? 0.5 : stars === 4 ? 0.3 : stars === 3 ? 0.12 : 0.04)
        ? SAMPLE_POSITIVE[Math.floor(rng() * SAMPLE_POSITIVE.length)]
        : "";
      rows.push(row);
    }
  }
  return rows;
}

/* ---------- Normalisierung ---------- */

const AGREE_TEXT_TO_VALUE = Object.fromEntries(
  Object.entries(AGREE_SCALE.labels).map(([v, l]) => [l.toLowerCase(), Number(v)])
);

/* Wandelt einen Exportwert in 1–5 oder null (fehlend/keine Angabe) um.
   Akzeptiert „4“, „A4“, „AO04“, „4 Sterne“ sowie die Textlabels der Zustimmungsskala. */
function parseScaleValue(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const byText = AGREE_TEXT_TO_VALUE[s.toLowerCase()];
  if (byText) return byText;
  const m = s.match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 5 ? n : null;
}

function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  return null;
}

function normalizeRow(row) {
  const submitted = parseDate(row.submitdate);
  const service = (row.Q00 || "").trim() || null;
  const items = {};
  ITEMS.forEach((it) => (items[it.code] = parseScaleValue(row[it.field])));
  return {
    id: String(row.id),
    submitted,
    started: parseDate(row.startdate),
    date: submitted || parseDate(row.datestamp) || parseDate(row.startdate),
    complete: !!submitted,
    language: row.startlanguage || "",
    service,
    office: service ? SERVICE_TO_OFFICE[service] || UNASSIGNED_OFFICE : UNASSIGNED_OFFICE,
    stars: parseScaleValue(row.G01Q02),
    items,
    textNegative: (row.G01Q04 || "").trim(),
    textPositive: (row.G01Q05 || "").trim(),
  };
}

/* ---------- CSV-Import (LimeSurvey-Export „Feldcode + Fragetext“) ---------- */

function detectDelimiter(firstLine) {
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const delim = detectDelimiter(text.split(/\r?\n/, 1)[0] || "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/* Ermittelt den Feldcode aus einer Spaltenüberschrift wie
   „G02Q03[SQ002]. Die einzelnen Schritte …“ oder „submitdate. Datum der Abgabe“. */
function headerToCode(header) {
  const m = String(header).trim().match(/^([A-Za-z][A-Za-z0-9_]*(?:\[[A-Za-z0-9_]+\])?)/);
  return m ? m[1] : null;
}

function importCsv(text) {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("Die Datei enthält keine Datenzeilen.");
  const codes = table[0].map(headerToCode);
  const required = [FIELD.id, FIELD.service, FIELD.stars];
  const missing = required.filter((c) => !codes.includes(c));
  if (missing.length) throw new Error(`Pflichtspalten fehlen: ${missing.join(", ")}`);
  const records = table.slice(1).map((cells) => {
    const row = {};
    codes.forEach((code, i) => code && (row[code] = cells[i] ?? ""));
    return normalizeRow(row);
  });
  const unknownServices = [...new Set(records.filter((r) => r.service && !SERVICE_TO_OFFICE[r.service]).map((r) => r.service))];
  return { records, unknownServices, foundItems: ITEMS.filter((it) => codes.includes(it.field)).map((it) => it.code) };
}

const SAMPLE_RECORDS = generateSampleExport().map(normalizeRow);
