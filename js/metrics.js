/* =====================================================================
   Berechnungen (reine Funktionen, ohne DOM) – auch per `node --test` geprüft.

   Definitionen (überall gleich):
   - Grundgesamtheit: nur abgeschlossene Fragebögen (submitdate gefüllt).
   - Nenner einer Kennzahl: alle Antworten mit gültigem Wert 1–5 auf DIESE Frage.
     Fehlende Werte / „keine Angabe“ zählen nicht in den Nenner und werden separat
     ausgewiesen. Fehlende Bewertungen werden nie als 0 Sterne gewertet.
   - Positiv/Zustimmung = Stufen 4+5, Mittel/Teils-teils = 3, Kritisch/Ablehnung = 1+2.
   - Prozentwerte werden nach dem Verfahren der größten Reste gerundet, damit die
     angezeigten Anteile einer Verteilung exakt 100 % ergeben und Gruppenwerte
     (z. B. 4+5) mit der Einzelverteilung übereinstimmen.
   ===================================================================== */

function largestRemainder(counts, total, digits = 0) {
  if (!total) return counts.map(() => null);
  const factor = 100 * 10 ** digits;
  const raw = counts.map((c) => (c / total) * factor);
  const floors = raw.map(Math.floor);
  let rest = factor - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < order.length && rest > 0; k++, rest--) floors[order[k][1]] += 1;
  return floors.map((v) => v / 10 ** digits);
}

/* Verteilung einer 5er-Skala. values: Array aus 1–5 oder null. */
function distribution(values, scale) {
  const counts = [0, 0, 0, 0, 0];
  let missing = 0;
  let sum = 0;
  values.forEach((v) => {
    if (v >= 1 && v <= 5) {
      counts[v - 1] += 1;
      sum += v;
    } else missing += 1;
  });
  const valid = counts.reduce((a, b) => a + b, 0);
  const pct = largestRemainder(counts, valid);
  const groups = {};
  for (const [key, g] of Object.entries(scale.groups)) {
    const n = g.values.reduce((a, v) => a + counts[v - 1], 0);
    const p = valid ? g.values.reduce((a, v) => a + pct[v - 1], 0) : null;
    groups[key] = { n, pct: p, label: g.label, desc: g.desc };
  }
  return {
    counts,
    pct,
    valid,
    missing,
    total: values.length,
    mean: valid ? sum / valid : null,
    groups,
    reliable: valid >= MIN_N_RELIABLE,
    showable: valid >= MIN_N_SHOW,
  };
}

function inRange(rec, range) {
  return rec.date && rec.date >= range.from && rec.date <= range.to;
}

/* Wendet Berechtigung (Demo-Rolle) und Ansichtsfilter an. */
function applyFilters(records, f) {
  return records.filter((r) => {
    if (!r.complete) return false;
    if (f.allowedOffices && !f.allowedOffices.includes(r.office)) return false;
    if (f.range && !inRange(r, f.range)) return false;
    if (f.office && f.office !== "Alle" && r.office !== f.office) return false;
    if (f.service && f.service !== "Alle" && r.service !== f.service) return false;
    return true;
  });
}

function starDist(records) {
  return distribution(records.map((r) => r.stars), STAR_SCALE);
}

function itemDist(records, code) {
  return distribution(records.map((r) => r.items[code]), AGREE_SCALE);
}

/* Vergleich aktueller vs. vorheriger Zeitraum. */
function compareDist(cur, prev) {
  if (!prev || !prev.showable || !cur.showable) return null;
  return {
    mean: cur.mean - prev.mean,
    positive: cur.groups.positive.pct - prev.groups.positive.pct,
    critical: cur.groups.critical.pct - prev.groups.critical.pct,
    prevN: prev.valid,
    reliable: cur.reliable && prev.reliable,
  };
}

/* Monatswerte (Ø Sterne + Fallzahl) für die 12 Monate bis `endDate`. */
function monthlySeries(records, endDate, months = 12) {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const from = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
    const to = new Date(endDate.getFullYear(), endDate.getMonth() - i + 1, 0, 23, 59, 59);
    const d = starDist(records.filter((r) => inRange(r, { from, to })));
    out.push({ from, to, mean: d.mean, n: d.valid, reliable: d.reliable, showable: d.showable, positive: d.groups.positive.pct });
  }
  return out;
}

/* Servicevergleich: Ø Sterne, Fallzahl, Anteile – je Service. */
function serviceTable(records, services) {
  return services.map((service) => {
    const recs = records.filter((r) => r.service === service);
    const d = starDist(recs);
    return {
      service,
      office: SERVICE_TO_OFFICE[service] || UNASSIGNED_OFFICE,
      n: d.valid,
      responses: recs.length,
      mean: d.mean,
      positive: d.groups.positive.pct,
      critical: d.groups.critical.pct,
      reliable: d.reliable,
      showable: d.showable,
    };
  });
}

/* Regelbasierte Themenzuordnung für offene Kritik (G01Q04). */
function matchThemes(text) {
  const t = text.toLowerCase();
  return THEMES.filter((th) => th.keywords.some((k) => t.includes(k))).map((th) => th.id);
}

function themeCounts(records) {
  const withText = records.filter((r) => r.textNegative);
  const counts = Object.fromEntries(THEMES.map((t) => [t.id, 0]));
  let unassigned = 0;
  withText.forEach((r) => {
    const ids = matchThemes(r.textNegative);
    if (!ids.length) unassigned += 1;
    ids.forEach((id) => (counts[id] += 1));
  });
  const list = THEMES.map((t) => ({ ...t, n: counts[t.id] }))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n);
  return { list, unassigned, totalTexts: withText.length };
}

/* Auswahlregel „Das läuft gut“: Kommentare aus G01Q05 von Personen,
   die insgesamt 5 Sterne vergeben haben – die neuesten zuerst. */
function praiseComments(records) {
  return records
    .filter((r) => r.stars === 5 && r.textPositive)
    .sort((a, b) => b.date - a.date);
}

if (typeof module !== "undefined") {
  module.exports = { largestRemainder, distribution, applyFilters, starDist, itemDist, compareDist, monthlySeries, serviceTable, matchThemes, themeCounts, praiseComments };
}
