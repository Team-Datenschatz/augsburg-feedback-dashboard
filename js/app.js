/* =====================================================================
   Oberfläche des Bürgerfeedback-Dashboards.
   - Zustand (Ansicht + Filter) steht in der URL (#/ansicht?zeitraum=…),
     dadurch bleiben Filter beim Wechsel Übersicht ↔ Details erhalten und
     der Zurück-Button des Browsers funktioniert.
   - Globale Filter (Zeitraum, Dienststelle, Service) gelten im ganzen Dashboard.
   - Lokale Filter (z. B. Sterne im Bereich „Bewertungen“) gelten nur dort.
   - Die Demo-Rolle simuliert Zugriffsrechte und ist von Ansichtsfiltern getrennt.
   ===================================================================== */

const VIEWS = {
  start: "Übersicht",
  bewertungen: "Bewertungen",
  textfeedback: "Textfeedback",
  services: "Services & Dienststellen",
  rueckmeldungen: "Einzelrückmeldungen",
  daten: "Daten & Methodik",
};
const GLOBAL_KEYS = ["zeitraum", "dienststelle", "service"];
const LAYOUT_KEY = "afd.layout.v1";
const ROLE_KEY = "afd.demoRolle.v1";

const DATA = {
  records: SAMPLE_RECORDS,
  source: "sample",
  fileName: "",
  lastUpdated: SAMPLE_LAST_UPDATED,
  periods: buildPeriods(DATA_END),
};

const ui = {
  customize: false,
  textSearch: "",
  tablePage: 1,
  lastFocus: null,
  dragId: null,
};

/* ---------------- Hilfsfunktionen ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const fmtInt = (n) => n.toLocaleString("de-DE");
const fmtMean = (m) => (m == null ? "–" : m.toFixed(1).replace(".", ","));
const fmtPct = (p) => (p == null ? "–" : `${String(p).replace(".", ",")} %`);
const fmtDate = (d) => (d ? d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–");
const fmtMonth = (d) => d.toLocaleDateString("de-DE", { month: "short" }).replace(".", "");

function signed(n, digits = 1) {
  const s = Math.abs(n).toFixed(digits).replace(".", ",");
  if (Number(Math.abs(n).toFixed(digits)) === 0) return "±0" + (digits ? "," + "0".repeat(digits) : "");
  return (n > 0 ? "+" : "−") + s;
}

/* ---------------- Routing / Zustand ---------------- */

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const view = VIEWS[path] ? path : "start";
  const params = Object.fromEntries(new URLSearchParams(query));
  return { view, params };
}

function buildHash(view, params) {
  const clean = Object.entries(params).filter(([, v]) => v != null && v !== "" && v !== "Alle");
  const q = new URLSearchParams(clean).toString();
  return `#/${view}${q ? "?" + q : ""}`;
}

/* Link, der die globalen Filter mitnimmt. */
function href(view, extra = {}) {
  const { params } = parseHash();
  const g = Object.fromEntries(GLOBAL_KEYS.map((k) => [k, params[k]]));
  return buildHash(view, { ...g, ...extra });
}

function go(view, extra = {}, { replace = false } = {}) {
  const h = href(view, extra);
  if (replace) history.replaceState(null, "", h);
  else location.hash = h;
  if (replace) render();
}

function currentRole() {
  const id = localStorage.getItem(ROLE_KEY) || "zentral";
  return DEMO_ROLES.find((r) => r.id === id) || DEMO_ROLES[0];
}

function allowedOffices() {
  return currentRole().offices || OFFICES;
}

function allowedServices(office) {
  const offices = office && office !== "Alle" ? [office] : allowedOffices();
  return CATALOG.filter((c) => offices.includes(c.office)).flatMap((c) => c.services);
}

/* Prüft globale Filter auf Gültigkeit und korrigiert widersprüchliche Kombinationen. */
function sanitizeGlobals(params) {
  const notes = [];
  const out = { ...params };
  if (!DATA.periods.some((p) => p.id === out.zeitraum)) out.zeitraum = DATA.periods[0].id;
  const role = currentRole();
  if (role.offices) {
    if (out.dienststelle !== role.offices[0]) out.dienststelle = role.offices[0];
  } else if (out.dienststelle && out.dienststelle !== "Alle" && !OFFICES.includes(out.dienststelle)) {
    notes.push(`Dienststelle „${out.dienststelle}“ ist unbekannt – Filter zurückgesetzt.`);
    delete out.dienststelle;
  }
  if (out.service && out.service !== "Alle") {
    const valid = allowedServices(out.dienststelle);
    if (!valid.includes(out.service)) {
      const owner = SERVICE_TO_OFFICE[out.service];
      notes.push(
        owner
          ? `Service-Auswahl „${out.service}“ zurückgesetzt: Der Service gehört zur Dienststelle „${owner}“, nicht zur gewählten Auswahl.`
          : `Service „${out.service}“ ist unbekannt – Filter zurückgesetzt.`
      );
      delete out.service;
    }
  }
  return { params: out, notes };
}

function getState() {
  const { view, params } = parseHash();
  const { params: p, notes } = sanitizeGlobals(params);
  const changed = GLOBAL_KEYS.some((k) => (p[k] || "") !== (params[k] || ""));
  if (changed) history.replaceState(null, "", buildHash(view, p));
  notes.forEach(toast);
  const period = DATA.periods.find((x) => x.id === p.zeitraum);
  return {
    view,
    params: p,
    period,
    office: p.dienststelle || "Alle",
    service: p.service || "Alle",
  };
}

function baseFilter(st, range) {
  return applyFilters(DATA.records, {
    allowedOffices: allowedOffices(),
    range,
    office: st.office,
    service: st.service,
  });
}

/* ---------------- Bausteine ---------------- */

function starsHtml(mean, size = "") {
  if (mean == null) return `<span class="stars-missing">keine Bewertung</span>`;
  const pct = Math.max(0, Math.min(100, (mean / 5) * 100));
  return `<span class="stars ${size}" role="img" aria-label="${fmtMean(mean)} von 5 Sternen">
    <span class="stars-bg" aria-hidden="true">★★★★★</span><span class="stars-fg" style="width:${pct}%" aria-hidden="true">★★★★★</span>
  </span>`;
}

function starsExact(v) {
  if (v == null) return `<span class="stars-missing">keine Angabe</span>`;
  return `<span class="stars-exact" role="img" aria-label="${v} von 5 Sternen"><span aria-hidden="true">${"★".repeat(v)}<span class="off">${"★".repeat(5 - v)}</span></span></span>`;
}

function lowNBadge(n) {
  if (n < MIN_N_SHOW) return `<span class="flag flag-none" title="Zu wenige Antworten für eine Auswertung">⚠ zu wenige Antworten (N = ${n})</span>`;
  if (n < MIN_N_RELIABLE) return `<span class="flag" title="Weniger als ${MIN_N_RELIABLE} Antworten – Werte schwanken stark">⚠ geringe Fallzahl (N = ${n})</span>`;
  return "";
}

/* 100-%-Balken einer 5er-Skala, links negativ → rechts positiv. */
function stackedBar(d, scale, { label = "" } = {}) {
  if (!d.showable) return `<div class="stack stack-empty">${lowNBadge(d.valid) || "Keine Daten"}</div>`;
  const segs = scale.values
    .map((v, i) => {
      const p = d.pct[i];
      if (!p) return "";
      const txt = p >= 9 ? `${p}&nbsp;%` : "";
      return `<span class="seg" style="flex-basis:${p}%;background:${SCALE_COLORS[v]};color:${SCALE_TEXT_ON[v]}" title="${esc(scale.labels[v])}: ${p} % (${d.counts[i]})">${txt}</span>`;
    })
    .join("");
  return `<div class="stack" role="img" aria-label="${esc(label)} ${scale.values.map((v, i) => `${scale.labels[v]} ${d.pct[i]} Prozent`).join(", ")}">${segs}</div>`;
}

function scaleLegend(scale) {
  return `<ul class="scale-legend" aria-label="Legende">${scale.values
    .map((v) => `<li><span class="sw" style="background:${SCALE_COLORS[v]}"></span>${esc(scale.labels[v])}</li>`)
    .join("")}</ul>`;
}

function groupsLine(d, scale) {
  const g = d.groups;
  return `<span class="g g-critical">${esc(scale.groups.critical.short)} ${fmtPct(g.critical.pct)}</span>
    <span class="g g-neutral">${esc(scale.groups.neutral.short)} ${fmtPct(g.neutral.pct)}</span>
    <span class="g g-positive">${esc(scale.groups.positive.short)} ${fmtPct(g.positive.pct)}</span>`;
}

function deltaHtml(value, unit, { higherIsBetter = true, prevLabel, reliable }) {
  if (value == null) return `<span class="delta delta-none">Kein Vergleich möglich (Vorzeitraum ohne ausreichende Daten)</span>`;
  const digits = unit === "Pp." ? 0 : 1;
  const rounded = Number(value.toFixed(digits));
  let cls = "delta-flat";
  let word = "unverändert";
  let arrow = "→";
  if (rounded > 0) {
    word = "höher";
    arrow = "▲";
    cls = higherIsBetter ? "delta-good" : "delta-bad";
  } else if (rounded < 0) {
    word = "niedriger";
    arrow = "▼";
    cls = higherIsBetter ? "delta-bad" : "delta-good";
  }
  const unitTxt = unit === "Pp." ? " Prozentpunkte" : "";
  return `<span class="delta ${cls}"><span aria-hidden="true">${arrow}</span> ${signed(value, digits)}${unitTxt} (${word}) ggü. ${esc(prevLabel)}${
    reliable ? "" : ` <span class="flag-inline">· Vergleich unsicher, geringe Fallzahl</span>`
  }</span>`;
}

function contextBar(st, n, nStars) {
  const scope =
    st.service !== "Alle"
      ? `Service „${esc(st.service)}“ (${esc(SERVICE_TO_OFFICE[st.service])})`
      : st.office !== "Alle"
      ? `Dienststelle ${esc(st.office)} (alle Services)`
      : "Alle Dienststellen und Services";
  return `<p class="context-bar">
    <span><b>Zeitraum:</b> ${esc(st.period.rangeText)}</span>
    <span><b>Bereich:</b> ${scope}</span>
    <span><b>Grundlage:</b> N&nbsp;=&nbsp;${fmtInt(n)} abgeschlossene Rückmeldungen${nStars != null ? `, davon ${fmtInt(nStars)} mit Sternebewertung` : ""}</span>
    <span class="context-note">Freiwilliges Feedback nach Nutzung – nicht repräsentativ für alle Augsburger*innen.</span>
  </p>`;
}

/* ---------------- Ansicht: Übersicht ---------------- */

const TILES = {
  gut: { title: "Das läuft gut", question: "Was läuft gut?", render: tileGood },
  potenzial: { title: "Verbesserungspotenziale", question: "Wo gibt es Verbesserungspotenzial?", render: tileImprove },
  aufmerksamkeit: { title: "Services mit Aufmerksamkeitsbedarf", question: "Welche Services benötigen Aufmerksamkeit?", render: tileAttention },
  verlauf: { title: "Zeitverlauf der Gesamtzufriedenheit", question: "Wie entwickelt sich die Bewertung?", render: tileTrend },
  verteilung: { title: "Verteilung der Sternebewertungen", question: "Wie verteilen sich die Antworten?", render: tileDistribution },
  aspekte: { title: "Bewertete Aspekte", question: "Welche Aspekte werden wie bewertet?", render: tileAspects },
};
const DEFAULT_LAYOUT = [
  { id: "gut", size: "M" },
  { id: "potenzial", size: "M" },
  { id: "aufmerksamkeit", size: "M" },
  { id: "verlauf", size: "M" },
  { id: "verteilung", size: "M" },
  { id: "aspekte", size: "M" },
];
const SIZES = { S: "Schmal (1/3)", M: "Mittel (1/2)", L: "Breit (2/3)", XL: "Volle Breite" };

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (Array.isArray(saved)) {
      const valid = saved.filter((t) => TILES[t.id] && SIZES[t.size]);
      const missing = DEFAULT_LAYOUT.filter((d) => !valid.some((v) => v.id === d.id));
      return [...valid, ...missing];
    }
  } catch (e) {
    /* ungültige Speicherung ignorieren */
  }
  return DEFAULT_LAYOUT.map((t) => ({ ...t }));
}
function saveLayout(layout) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}
function isDefaultLayout(layout) {
  return JSON.stringify(layout) === JSON.stringify(DEFAULT_LAYOUT);
}

function viewStart(st) {
  const cur = baseFilter(st, st.period);
  const prev = baseFilter(st, st.period.prev);
  const d = starDist(cur);
  const dPrev = starDist(prev);
  const cmp = compareDist(d, dPrev);
  const success = itemDist(cur, "SQ001");
  const successPrev = itemDist(prev, "SQ001");
  const successDelta = success.showable && successPrev.showable ? success.groups.positive.pct - successPrev.groups.positive.pct : null;
  const ctx = { st, cur, prev, d, dPrev };
  const layout = loadLayout();
  const cmpReliable = cmp ? cmp.reliable : false;

  const kpis = `
    <section class="kpi-row" aria-label="Kennzahlen">
      <a class="card kpi clickable" href="${href("bewertungen")}">
        <h3>Ø Gesamtzufriedenheit</h3>
        <div class="kpi-main"><span class="value">${d.showable ? fmtMean(d.mean) : "–"}</span>${d.showable ? starsHtml(d.mean, "lg") : ""}</div>
        <div class="sub">von 5 Sternen · N = ${fmtInt(d.valid)} Bewertungen ${lowNBadge(d.valid)}</div>
        ${deltaHtml(cmp ? cmp.mean : null, "", { prevLabel: st.period.prevLabel, reliable: cmpReliable })}
      </a>
      <a class="card kpi clickable" href="${href("bewertungen", { sterne: "4,5" })}">
        <h3>Positive Bewertungen</h3>
        <div class="kpi-main"><span class="value">${d.showable ? fmtPct(d.groups.positive.pct) : "–"}</span></div>
        <div class="sub">4 oder 5 Sterne · ${fmtInt(d.groups.positive.n)} von ${fmtInt(d.valid)}</div>
        ${miniSplit(d)}
        ${deltaHtml(cmp ? cmp.positive : null, "Pp.", { prevLabel: st.period.prevLabel, reliable: cmpReliable })}
      </a>
      <a class="card kpi clickable" href="${href("bewertungen", { sterne: "1,2" })}">
        <h3>Kritische Bewertungen</h3>
        <div class="kpi-main"><span class="value">${d.showable ? fmtPct(d.groups.critical.pct) : "–"}</span></div>
        <div class="sub">1 oder 2 Sterne · ${fmtInt(d.groups.critical.n)} von ${fmtInt(d.valid)}</div>
        ${miniSplit(d)}
        ${deltaHtml(cmp ? cmp.critical : null, "Pp.", { higherIsBetter: false, prevLabel: st.period.prevLabel, reliable: cmpReliable })}
      </a>
      <a class="card kpi clickable" href="${href("bewertungen", { aussage: "SQ001", kategorie: "positive" })}">
        <h3>Anliegen erfolgreich erledigt</h3>
        <div class="kpi-main"><span class="value">${success.showable ? fmtPct(success.groups.positive.pct) : "–"}</span></div>
        <div class="sub">Zustimmung („stimme eher/voll zu“) · ${fmtInt(success.groups.positive.n)} von ${fmtInt(success.valid)}</div>
        ${deltaHtml(successDelta, "Pp.", { prevLabel: st.period.prevLabel, reliable: success.reliable && successPrev.reliable })}
      </a>
    </section>
    <p class="kpi-foot">Anteile beziehen sich auf alle Antworten mit Bewertung (Nenner). Ohne Angabe: ${fmtInt(d.missing)} Rückmeldungen ohne Sternebewertung – nicht im Nenner, nicht als 0 Sterne gezählt.
      <a href="${href("daten")}#definitionen">Definitionen</a></p>`;

  const tiles = layout
    .map((t, idx) => {
      const def = TILES[t.id];
      return `<article class="card tile size-${t.size}" data-tile="${t.id}" ${ui.customize ? 'draggable="true"' : ""} aria-labelledby="tile-${t.id}">
        ${ui.customize ? tileControls(t, idx, layout.length) : ""}
        <p class="eyebrow">${esc(def.question)}</p>
        <h2 class="card-title" id="tile-${t.id}">${esc(def.title)}</h2>
        ${def.render(ctx)}
      </article>`;
    })
    .join("");

  return `
    <div class="view-head">
      <div>
        <h2 class="view-title">Übersicht</h2>
        ${contextBar(st, cur.length, d.valid)}
      </div>
      <div class="view-actions">
        <button class="btn secondary" data-action="toggle-customize" aria-pressed="${ui.customize}">${ui.customize ? "Anpassung beenden" : "Ansicht anpassen"}</button>
        ${!isDefaultLayout(layout) || ui.customize ? `<button class="btn ghost" data-action="reset-layout">Standardansicht wiederherstellen</button>` : ""}
      </div>
    </div>
    ${ui.customize ? `<p class="customize-hint" role="status">Kacheln per Ziehen am Griff ⠿ verschieben oder mit den Pfeiltasten-Schaltflächen „Nach vorne“/„Nach hinten“. Die Größe wählen Sie im Auswahlfeld. Ihre Anordnung wird in diesem Browser gespeichert.</p>` : ""}
    ${kpis}
    <section class="tile-grid ${ui.customize ? "is-customizing" : ""}" aria-label="Kacheln">${tiles}</section>`;
}

function miniSplit(d) {
  if (!d.showable) return "";
  return `<div class="mini-split" aria-hidden="true">
      <span style="flex-basis:${d.groups.critical.pct}%;background:${SCALE_COLORS[1]}"></span>
      <span style="flex-basis:${d.groups.neutral.pct}%;background:${SCALE_COLORS[3]}"></span>
      <span style="flex-basis:${d.groups.positive.pct}%;background:${SCALE_COLORS[5]}"></span>
    </div>
    <div class="mini-legend">${groupsLine(d, STAR_SCALE)}</div>`;
}

function tileControls(t, idx, total) {
  return `<div class="tile-controls">
    <span class="drag-handle" title="Zum Verschieben ziehen" aria-hidden="true">⠿</span>
    <button class="btn-mini" data-action="tile-move" data-id="${t.id}" data-dir="-1" ${idx === 0 ? "disabled" : ""} aria-label="${esc(TILES[t.id].title)} nach vorne verschieben">↑ Nach vorne</button>
    <button class="btn-mini" data-action="tile-move" data-id="${t.id}" data-dir="1" ${idx === total - 1 ? "disabled" : ""} aria-label="${esc(TILES[t.id].title)} nach hinten verschieben">↓ Nach hinten</button>
    <label class="size-select">Größe
      <select data-action="tile-size" data-id="${t.id}">${Object.entries(SIZES)
        .map(([k, v]) => `<option value="${k}" ${k === t.size ? "selected" : ""}>${v}</option>`)
        .join("")}</select>
    </label>
  </div>`;
}

function tileGood({ st, cur }) {
  const aspects = ITEMS.map((it) => ({ it, d: itemDist(cur, it.code) })).filter((a) => a.d.reliable);
  const bestAspect = aspects.sort((a, b) => b.d.groups.positive.pct - a.d.groups.positive.pct)[0];
  const services = st.service === "Alle" ? serviceTable(cur, allowedServices(st.office)).filter((s) => s.reliable) : [];
  const topServices = services.sort((a, b) => b.mean - a.mean).slice(0, 2);
  const praise = praiseComments(cur);
  const shown = praise.slice(0, 3);
  return `
    <ul class="good-facts">
      ${bestAspect ? `<li><span class="fact-label">Höchste Zustimmung</span> <a href="${href("bewertungen", { aussage: bestAspect.it.code, kategorie: "positive" })}"><b>${esc(bestAspect.it.label)}</b></a> – ${fmtPct(bestAspect.d.groups.positive.pct)} Zustimmung</li>` : ""}
      ${topServices
        .map(
          (s) => `<li><span class="fact-label">Hoch bewertet</span> <a href="${href("rueckmeldungen", { svc: s.service, zurueck: "start" })}"><b>${esc(s.service)}</b></a> – Ø ${fmtMean(s.mean)} ★ (N = ${fmtInt(s.n)})</li>`
        )
        .join("")}
    </ul>
    <h3 class="sub-title">Lob aus den Kommentaren</h3>
    ${
      shown.length
        ? `<div class="quotes">${shown.map(quoteCard).join("")}</div>
           <p class="selection-rule">Auswahl: die ${shown.length} neuesten von ${fmtInt(praise.length)} Kommentaren zu „Was hat Ihnen besonders gut gefallen?“ von Personen, die insgesamt <b>5 Sterne</b> vergeben haben.
           <a href="${href("textfeedback", { art: "lob", sterne: "5" })}">Alle ${fmtInt(praise.length)} ansehen →</a></p>`
        : `<p class="empty">Im gewählten Filter gibt es keine Kommentare von Personen mit 5 Sternen.</p>`
    }`;
}

function quoteCard(r) {
  return `<button class="quote" data-action="detail" data-id="${esc(r.id)}">
    <span class="quote-text">${esc(r.textPositive)}</span>
    <span class="quote-meta">${starsExact(r.stars)} · ${esc(r.service)} · ${fmtDate(r.date)}</span>
  </button>`;
}

function tileImprove({ cur }) {
  const t = themeCounts(cur);
  const aspects = ITEMS.map((it) => ({ it, d: itemDist(cur, it.code) })).filter((a) => a.d.reliable);
  const weakest = aspects.sort((a, b) => a.d.groups.positive.pct - b.d.groups.positive.pct)[0];
  const max = t.list.length ? t.list[0].n : 1;
  return `
    ${weakest ? `<p class="weak-aspect"><span class="fact-label">Geringste Zustimmung</span> <a href="${href("bewertungen", { aussage: weakest.it.code, kategorie: "critical" })}"><b>${esc(weakest.it.label)}</b></a> – ${fmtPct(weakest.d.groups.positive.pct)} Zustimmung, ${fmtPct(weakest.d.groups.critical.pct)} Ablehnung</p>` : ""}
    <h3 class="sub-title">Häufige Themen in der Kritik</h3>
    ${
      t.list.length
        ? `<ol class="theme-list">${t.list
            .slice(0, 5)
            .map(
              (th) => `<li><a class="theme-row" href="${href("textfeedback", { art: "kritik", thema: th.id })}">
                <span class="theme-label">${esc(th.label)}</span>
                <span class="theme-bar"><span style="width:${(th.n / max) * 100}%"></span></span>
                <span class="theme-n">${fmtInt(th.n)}</span>
              </a></li>`
            )
            .join("")}</ol>
          <p class="selection-rule">Grundlage: ${fmtInt(t.totalTexts)} Antworten auf „Was war besonders schlecht?“. Zuordnung per Stichwortliste, Mehrfachzuordnung möglich; ${fmtInt(t.unassigned)} Kommentare ohne Themenzuordnung.
            Häufigkeit zeigt, worüber geschrieben wird – nicht die Ursache von Bewertungen.
            <a href="${href("textfeedback", { art: "kritik" })}">Alle Kommentare →</a></p>`
        : `<p class="empty">Keine kritischen Kommentare im gewählten Filter.</p>`
    }`;
}

function tileAttention({ st, cur }) {
  if (st.service !== "Alle") {
    const d = starDist(cur);
    return `<p>Es ist ein einzelner Service ausgewählt. Vergleich aller Services: <a href="${href("services")}">Services &amp; Dienststellen →</a></p>
      <p>Ø ${fmtMean(d.mean)} ★ bei N = ${fmtInt(d.valid)} ${lowNBadge(d.valid)}</p>`;
  }
  const rows = serviceTable(cur, allowedServices(st.office));
  const reliable = rows.filter((r) => r.reliable).sort((a, b) => a.mean - b.mean);
  const excluded = rows.filter((r) => !r.reliable);
  const lowest = reliable.slice(0, 3);
  const all = starDist(cur);
  return `
    <p class="tile-intro">Die drei Services mit der niedrigsten Ø-Sternebewertung (nur Services mit mindestens ${MIN_N_RELIABLE} Bewertungen).</p>
    ${lowest.length ? `<div class="svc-compare">${lowest.map((r) => serviceDotRow(r, all.mean)).join("")}</div>${dotAxis(all.mean)}` : `<p class="empty">Kein Service erreicht die Mindestfallzahl.</p>`}
    <p class="selection-rule">${excluded.length ? `${excluded.length} Service(s) wegen geringer Fallzahl nicht eingeordnet. ` : ""}Senkrechte Linie: Ø aller ausgewählten Services (${fmtMean(all.mean)}).
      <a href="${href("services")}">Alle Services vergleichen →</a></p>`;
}

/* Punkt auf einer festen 1–5-Achse (gleiche Skala in allen Ansichten). */
function dotPos(m) {
  return ((m - 1) / 4) * 100;
}
function serviceDotRow(r, ref) {
  return `<a class="svc-row" href="${href("rueckmeldungen", { svc: r.service, zurueck: parseHash().view })}">
    <span class="svc-name"><b>${esc(r.service)}</b><small>${esc(r.office)} · N = ${fmtInt(r.n)} ${r.reliable ? "" : lowNBadge(r.n)}</small></span>
    <span class="dot-track">${ref != null ? `<span class="ref-line" style="left:${dotPos(ref)}%"></span>` : ""}${r.showable ? `<span class="dot ${r.reliable ? "" : "dot-low"}" style="left:${dotPos(r.mean)}%"></span>` : ""}</span>
    <span class="svc-val">${r.showable ? fmtMean(r.mean) + " ★" : "–"}</span>
  </a>`;
}
function dotAxis() {
  return `<div class="dot-axis" aria-hidden="true"><span></span><span class="ticks">${[1, 2, 3, 4, 5].map((v) => `<i style="left:${dotPos(v)}%">${v} ★</i>`).join("")}</span><span></span></div>`;
}

function tileTrend({ st }) {
  const recs = applyFilters(DATA.records, { allowedOffices: allowedOffices(), office: st.office, service: st.service });
  const series = monthlySeries(recs, st.period.to);
  const W = 520;
  const H = 190;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 44;
  const x = (i) => padL + (i + 0.5) * ((W - padL - padR) / series.length);
  const y = (m) => padT + (1 - (m - 1) / 4) * (H - padT - padB);
  const inSel = (pt) => pt.from >= st.period.from && pt.to <= st.period.to;
  const bandW = (W - padL - padR) / series.length;
  const bands = series.map((pt, i) => (inSel(pt) ? `<rect x="${x(i) - bandW / 2}" y="${padT}" width="${bandW}" height="${H - padT - padB}" class="sel-band"/>` : "")).join("");
  const grid = [1, 2, 3, 4, 5]
    .map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${padL - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v}</text>`)
    .join("");
  let path = "";
  series.forEach((pt, i) => {
    if (!pt.showable) return;
    path += `${path && series[i - 1]?.showable ? "L" : "M"}${x(i)},${y(pt.mean)} `;
  });
  const pts = series
    .map((pt, i) =>
      pt.showable
        ? `<circle cx="${x(i)}" cy="${y(pt.mean)}" r="5" class="${pt.reliable ? "pt" : "pt pt-low"}"><title>${fmtMonth(pt.from)} ${pt.from.getFullYear()}: Ø ${fmtMean(pt.mean)} ★, N = ${pt.n}</title></circle>`
        : ""
    )
    .join("");
  const labels = series
    .map(
      (pt, i) => `<text x="${x(i)}" y="${H - padB + 16}" class="axis" text-anchor="middle">${fmtMonth(pt.from)}</text>
      <text x="${x(i)}" y="${H - padB + 30}" class="axis axis-n" text-anchor="middle">${pt.n}</text>`
    )
    .join("");
  const anyLow = series.some((p) => !p.reliable);
  return `
    <p class="tile-intro">Ø Sterne je Monat, 12 Monate bis Ende des gewählten Zeitraums. Hinterlegt: gewählter Zeitraum. Unter den Monaten: Fallzahl N.</p>
    <svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Liniendiagramm Ø Sternebewertung je Monat">
      ${bands}${grid}<path d="${path}" class="line"/>${pts}${labels}
      <text x="${padL - 30}" y="${H - padB + 30}" class="axis axis-n">N</text>
    </svg>
    ${anyLow ? `<p class="selection-rule"><span class="legend-pt-low" aria-hidden="true"></span> Heller Punkt: weniger als ${MIN_N_RELIABLE} Bewertungen im Monat – Wert schwankt stark.</p>` : ""}
    <details class="table-alt"><summary>Werte als Tabelle</summary>
      <table><thead><tr><th scope="col">Monat</th><th scope="col">Ø Sterne</th><th scope="col">Positiv</th><th scope="col">N</th></tr></thead>
      <tbody>${series.map((p) => `<tr><td>${fmtMonth(p.from)} ${p.from.getFullYear()}</td><td>${p.showable ? fmtMean(p.mean) : "–"}</td><td>${p.showable ? fmtPct(p.positive) : "–"}</td><td>${p.n}</td></tr>`).join("")}</tbody></table>
    </details>`;
}

function starColumns(d, { selected = null, clickable = false } = {}) {
  const maxPct = Math.max(1, ...d.pct.map((p) => p || 0));
  const cols = STAR_SCALE.values
    .map((v, i) => {
      const p = d.pct[i] ?? 0;
      const isSel = selected ? selected.includes(String(v)) : true;
      const tag = clickable ? "button" : "div";
      const attrs = clickable ? `data-action="toggle-star" data-star="${v}" aria-pressed="${selected && selected.includes(String(v))}"` : "";
      return `<${tag} class="col ${isSel ? "" : "dim"}" ${attrs} title="${v} Sterne: ${d.counts[i]} Bewertungen (${p} %)">
        <span class="col-val">${d.valid ? `${p}&nbsp;%` : "–"}<small>${fmtInt(d.counts[i])}</small></span>
        <span class="col-bar" style="height:${(p / maxPct) * 100}%;background:${SCALE_COLORS[v]}"></span>
        <span class="col-label">${v} ★</span>
      </${tag}>`;
    })
    .join("");
  return `<div class="cols" role="group" aria-label="Verteilung der Sternebewertungen">${cols}
      <div class="col col-missing" title="Ohne Sternebewertung – nicht im Nenner">
        <span class="col-val">${fmtInt(d.missing)}<small>ohne Angabe</small></span>
        <span class="col-bar hatch" style="height:${d.total ? Math.min(100, (d.missing / Math.max(1, d.valid)) * 100 / (maxPct / 100)) : 0}%"></span>
        <span class="col-label">–</span>
      </div>
    </div>
    <div class="col-groups" aria-hidden="true">
      <span class="grp grp-critical" style="grid-column:1 / span 2">Kritisch · ${fmtPct(d.groups.critical.pct)}</span>
      <span class="grp grp-neutral" style="grid-column:3">Mittel · ${fmtPct(d.groups.neutral.pct)}</span>
      <span class="grp grp-positive" style="grid-column:4 / span 2">Positiv · ${fmtPct(d.groups.positive.pct)}</span>
    </div>`;
}

function tileDistribution({ d }) {
  return `
    <p class="tile-intro">„${esc(QUESTION_TEXT.G01Q02)}“ – alle Antworten. Prozent bezogen auf ${fmtInt(d.valid)} Bewertungen; ${fmtInt(d.missing)} ohne Angabe (nicht im Nenner).</p>
    ${starColumns(d)}
    <p class="selection-rule"><a href="${href("bewertungen")}">Nach Sternen filtern →</a></p>`;
}

function tileAspects({ cur }) {
  return `
    <p class="tile-intro">Zustimmung zu fünf Aussagen (5-stufige Skala). Links Ablehnung, rechts Zustimmung.</p>
    ${scaleLegend(AGREE_SCALE)}
    <div class="aspects compact">${ITEMS.map((it) => aspectRow(it, itemDist(cur, it.code), { compact: true })).join("")}</div>
    <p class="selection-rule"><a href="${href("bewertungen")}">Details und Fragetexte →</a></p>`;
}

function aspectRow(it, d, { compact = false, active = false } = {}) {
  return `<div class="aspect ${active ? "is-active" : ""}">
    <div class="aspect-head">
      <h3 class="aspect-label">${esc(it.label)}</h3>
      <span class="aspect-kpi">${d.showable ? `<b>${fmtPct(d.groups.positive.pct)}</b> Zustimmung` : lowNBadge(d.valid)}</span>
    </div>
    ${stackedBar(d, AGREE_SCALE, { label: it.label })}
    <div class="aspect-foot">
      <span>${groupsLine(d, AGREE_SCALE)}</span>
      <span class="muted">n = ${fmtInt(d.valid)} · ohne Angabe ${fmtInt(d.missing)} ${d.showable && !d.reliable ? lowNBadge(d.valid) : ""}</span>
    </div>
    ${
      compact
        ? ""
        : `<details class="question"><summary>Fragetext anzeigen</summary><p>„${esc(it.text)}“ <span class="muted">(Feld ${esc(it.field)})</span></p></details>`
    }
  </div>`;
}

/* ---------------- Ansicht: Bewertungen ---------------- */

function ratingFilters(params) {
  return {
    stars: params.sterne ? params.sterne.split(",").filter((s) => /^[1-5]$|^fehlend$/.test(s)) : [],
    item: ITEMS.some((i) => i.code === params.aussage) ? params.aussage : "",
    cat: ["positive", "neutral", "critical", "missing"].includes(params.kategorie) ? params.kategorie : "",
  };
}

function applyRatingFilters(recs, f, { skipStars = false } = {}) {
  return recs.filter((r) => {
    if (!skipStars && f.stars.length) {
      const key = r.stars == null ? "fehlend" : String(r.stars);
      if (!f.stars.includes(key)) return false;
    }
    if (f.item && f.cat) {
      const v = r.items[f.item];
      if (f.cat === "missing") return v == null;
      if (v == null || !AGREE_SCALE.groups[f.cat].values.includes(v)) return false;
    }
    return true;
  });
}

function viewRatings(st) {
  const base = baseFilter(st, st.period);
  const f = ratingFilters(st.params);
  const forStars = applyRatingFilters(base, f, { skipStars: true });
  const recs = applyRatingFilters(base, f);
  const d = starDist(forStars);
  const active = f.stars.length || (f.item && f.cat);
  const itemLabel = f.item ? ITEMS.find((i) => i.code === f.item).label : "";
  const localChips = [
    f.stars.length ? `Sterne: ${f.stars.map((s) => (s === "fehlend" ? "ohne Angabe" : s + " ★")).join(", ")}` : "",
    f.item && f.cat ? `${itemLabel}: ${f.cat === "missing" ? "ohne Angabe" : AGREE_SCALE.groups[f.cat].label}` : "",
  ].filter(Boolean);

  return `
    <div class="view-head">
      <div>
        <h2 class="view-title">Bewertungen</h2>
        <p class="view-desc">Strukturierte Antworten: Sternebewertung zur Gesamtzufriedenheit und Zustimmung zu fünf Aussagen. Offene Kommentare finden Sie unter <a href="${href("textfeedback")}">Textfeedback</a>.</p>
        ${contextBar(st, base.length, starDist(base).valid)}
      </div>
    </div>

    <section class="card local-filters" aria-labelledby="lf-title">
      <h3 id="lf-title" class="card-title">Filter für diesen Bereich <span class="scope-tag">gilt nur für „Bewertungen“</span></h3>
      <div class="lf-row">
        <fieldset class="chip-group">
          <legend>Sterne (Gesamtzufriedenheit)</legend>
          ${STAR_SCALE.values
            .map((v) => `<button class="chip" data-action="toggle-star" data-star="${v}" aria-pressed="${f.stars.includes(String(v))}">${v} ★</button>`)
            .join("")}
          <button class="chip" data-action="toggle-star" data-star="fehlend" aria-pressed="${f.stars.includes("fehlend")}">ohne Angabe</button>
        </fieldset>
        <div class="lf-item">
          <label>Aussage
            <select data-action="rf-item">
              <option value="">– keine –</option>
              ${ITEMS.map((i) => `<option value="${i.code}" ${f.item === i.code ? "selected" : ""}>${esc(i.label)}</option>`).join("")}
            </select>
          </label>
          <label>Antwortkategorie
            <select data-action="rf-cat" ${f.item ? "" : "disabled"}>
              <option value="">– alle –</option>
              ${["positive", "neutral", "critical"].map((k) => `<option value="${k}" ${f.cat === k ? "selected" : ""}>${AGREE_SCALE.groups[k].label} (${AGREE_SCALE.groups[k].values.join("+")})</option>`).join("")}
              <option value="missing" ${f.cat === "missing" ? "selected" : ""}>ohne Angabe</option>
            </select>
          </label>
        </div>
      </div>
      <p class="lf-note">Dienststelle, Service und Zeitraum stellen Sie oben ein – diese Filter gelten im gesamten Dashboard.</p>
      ${
        active
          ? `<div class="lf-active" role="status"><span>Aktiv: ${localChips.map(esc).join(" · ")} → <b>${fmtInt(recs.length)}</b> von ${fmtInt(base.length)} Rückmeldungen</span>
             <button class="btn-mini" data-action="rf-reset">Bereichsfilter zurücksetzen</button></div>`
          : ""
      }
    </section>

    <section class="split">
      <article class="card">
        <h3 class="card-title">Gesamtzufriedenheit (Sterne)</h3>
        <p class="tile-intro">„${esc(QUESTION_TEXT.G01Q02)}“ ${f.item && f.cat ? `– nur Rückmeldungen mit ${esc(itemLabel)} = ${f.cat === "missing" ? "ohne Angabe" : AGREE_SCALE.groups[f.cat].label}` : ""}</p>
        <div class="dist-summary">${d.showable ? `<span class="value">${fmtMean(d.mean)}</span> ${starsHtml(d.mean, "lg")} <span class="muted">von 5 · N = ${fmtInt(d.valid)}</span>` : lowNBadge(d.valid) || "Keine Daten"}</div>
        ${starColumns(d, { selected: f.stars.length ? f.stars : null, clickable: true })}
        <p class="selection-rule">Säule anklicken, um nach Sternen zu filtern. Prozent bezogen auf ${fmtInt(d.valid)} Bewertungen mit Sternen; „ohne Angabe“ zählt nicht in den Nenner.
          Positiv = 4 + 5 Sterne, Mittel = 3, Kritisch = 1 + 2.</p>
      </article>
      <article class="card">
        <h3 class="card-title">Bewertete Aspekte (Zustimmung)</h3>
        <p class="tile-intro">„${esc(QUESTION_TEXT.G02Q03)}“ ${active ? `– für die ${fmtInt(recs.length)} gefilterten Rückmeldungen` : ""}</p>
        ${scaleLegend(AGREE_SCALE)}
        <div class="aspects">${ITEMS.map((it) => aspectRow(it, itemDist(recs, it.code), { active: it.code === f.item })).join("")}</div>
      </article>
    </section>

    ${responsesTable(recs, "Einzelbewertungen")}`;
}

function responsesTable(recs, title) {
  const sorted = [...recs].sort((a, b) => b.date - a.date);
  const shown = sorted.slice(0, ui.tablePage * 25);
  const rows = shown
    .map((r) => {
      const answered = ITEMS.filter((i) => r.items[i.code] != null);
      const agree = answered.filter((i) => r.items[i.code] >= 4).length;
      const hasText = r.textNegative || r.textPositive;
      return `<tr>
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.service || "–")}<br><small class="muted">${esc(r.office)}</small></td>
        <td>${starsExact(r.stars)}</td>
        <td>${answered.length ? `${agree} von ${answered.length} Aussagen` : "–"}</td>
        <td>${hasText ? `<span class="text-flag">💬 ${[r.textNegative ? "Kritik" : "", r.textPositive ? "Lob" : ""].filter(Boolean).join(" + ")}</span>` : `<span class="muted">–</span>`}</td>
        <td><button class="btn-mini" data-action="detail" data-id="${esc(r.id)}" aria-label="Rückmeldung vom ${fmtDate(r.date)} öffnen">Details</button></td>
      </tr>`;
    })
    .join("");
  return `<article class="card">
    <h3 class="card-title">${esc(title)} (${fmtInt(recs.length)})</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Datum</th><th scope="col">Service / Dienststelle</th><th scope="col">Sterne</th><th scope="col">Zustimmung (4–5)</th><th scope="col">Kommentar</th><th scope="col"><span class="sr-only">Aktion</span></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="empty">Keine Rückmeldungen für diese Filterkombination.</td></tr>`}</tbody>
      </table>
    </div>
    ${shown.length < sorted.length ? `<p class="more"><button class="btn secondary" data-action="more-rows">Weitere 25 anzeigen (${fmtInt(shown.length)} von ${fmtInt(sorted.length)})</button></p>` : ""}
  </article>`;
}

/* ---------------- Ansicht: Textfeedback ---------------- */

function viewTexts(st) {
  const base = baseFilter(st, st.period);
  const art = st.params.art === "lob" ? "lob" : "kritik";
  const field = art === "lob" ? "textPositive" : "textNegative";
  const themeId = THEMES.some((t) => t.id === st.params.thema) || st.params.thema === "ohne" ? st.params.thema : "";
  const stars = st.params.sterne ? st.params.sterne.split(",").filter((s) => /^[1-5]$/.test(s)) : [];
  const withText = base.filter((r) => r[field]);
  const nNeg = base.filter((r) => r.textNegative).length;
  const nPos = base.filter((r) => r.textPositive).length;
  const themes = art === "kritik" ? themeCounts(base) : null;
  let list = withText.filter((r) => !stars.length || stars.includes(String(r.stars)));
  if (art === "kritik" && themeId) {
    list = list.filter((r) => {
      const ids = matchThemes(r.textNegative);
      return themeId === "ohne" ? !ids.length : ids.includes(themeId);
    });
  }
  list.sort((a, b) => b.date - a.date);

  return `
    <div class="view-head">
      <div>
        <h2 class="view-title">Textfeedback</h2>
        <p class="view-desc">Offene, schriftliche Rückmeldungen. Jeder Kommentar gehört zu einer Rückmeldung mit Sternebewertung – diese wird beim Kommentar angezeigt. Strukturierte Bewertungen finden Sie unter <a href="${href("bewertungen")}">Bewertungen</a>.</p>
        ${contextBar(st, base.length)}
      </div>
    </div>
    <div class="tabs" role="tablist" aria-label="Art des Textfeedbacks">
      <a role="tab" aria-selected="${art === "kritik"}" class="tab ${art === "kritik" ? "is-active" : ""}" href="${href("textfeedback", { art: "kritik" })}">Kritik: „Was war besonders schlecht?“ <span class="count">${fmtInt(nNeg)}</span></a>
      <a role="tab" aria-selected="${art === "lob"}" class="tab ${art === "lob" ? "is-active" : ""}" href="${href("textfeedback", { art: "lob" })}">Lob: „Was hat besonders gut gefallen?“ <span class="count">${fmtInt(nPos)}</span></a>
    </div>
    <section class="card local-filters">
      <p class="tile-intro">Frage (${art === "lob" ? "G01Q05" : "G01Q04"}): „${esc(art === "lob" ? QUESTION_TEXT.G01Q05 : QUESTION_TEXT.G01Q04)}“
      ${art === "kritik" ? " Annahme: wird nur bei weniger als 5 Sternen angezeigt." : ""}</p>
      ${
        themes
          ? `<fieldset class="chip-group"><legend>Thema (Stichwort-Zuordnung, Mehrfachzuordnung möglich)</legend>
              <a class="chip" aria-pressed="${!themeId}" href="${href("textfeedback", { art, sterne: stars.join(",") })}">Alle</a>
              ${themes.list.map((t) => `<a class="chip" aria-pressed="${themeId === t.id}" href="${href("textfeedback", { art, thema: t.id, sterne: stars.join(",") })}">${esc(t.label)} <span class="count">${t.n}</span></a>`).join("")}
              <a class="chip" aria-pressed="${themeId === "ohne"}" href="${href("textfeedback", { art, thema: "ohne", sterne: stars.join(",") })}">Ohne Thema <span class="count">${themes.unassigned}</span></a>
            </fieldset>
            <details class="question"><summary>Wie werden Themen zugeordnet?</summary>
              <p>Ein Kommentar wird einem Thema zugeordnet, wenn er eines der hinterlegten Stichwörter enthält. Die Liste ist unter <a href="${href("daten")}#themen">Daten &amp; Methodik</a> einsehbar. Es gibt keine automatische Zusammenfassung.</p></details>`
          : ""
      }
      <div class="lf-row">
        <fieldset class="chip-group"><legend>Sterne der zugehörigen Bewertung</legend>
          ${STAR_SCALE.values
            .map((v) => {
              const next = stars.includes(String(v)) ? stars.filter((s) => s !== String(v)) : [...stars, String(v)];
              return `<a class="chip" aria-pressed="${stars.includes(String(v))}" href="${href("textfeedback", { art, thema: themeId, sterne: next.sort().join(",") })}">${v} ★</a>`;
            })
            .join("")}
        </fieldset>
        <label class="search-label">Suche im Text
          <input type="search" class="search" id="text-search" value="${esc(ui.textSearch)}" placeholder="z. B. Upload" />
        </label>
      </div>
    </section>
    <div id="text-results">${textResults(list, field)}</div>`;
}

function textResults(list, field) {
  const q = ui.textSearch.trim().toLowerCase();
  const filteredList = q ? list.filter((r) => r[field].toLowerCase().includes(q)) : list;
  const shown = filteredList.slice(0, ui.tablePage * 24);
  return `<p class="result-count" role="status">${fmtInt(filteredList.length)} Kommentare</p>
    <div class="comment-grid">${
      shown
        .map((r) => {
          const tags = field === "textNegative" ? matchThemes(r.textNegative).map((id) => THEMES.find((t) => t.id === id).label) : [];
          return `<button class="card comment clickable" data-action="detail" data-id="${esc(r.id)}">
            <span class="comment-text">${esc(r[field])}</span>
            ${tags.length ? `<span class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</span>` : ""}
            <span class="quote-meta">Bewertung: ${starsExact(r.stars)} · ${esc(r.service)} · ${esc(r.office)} · ${fmtDate(r.date)}</span>
          </button>`;
        })
        .join("") || `<p class="empty">Keine Kommentare für diese Auswahl.</p>`
    }</div>
    ${shown.length < filteredList.length ? `<p class="more"><button class="btn secondary" data-action="more-rows">Weitere anzeigen (${fmtInt(shown.length)} von ${fmtInt(filteredList.length)})</button></p>` : ""}`;
}

/* ---------------- Ansicht: Services & Dienststellen ---------------- */

function viewServices(st) {
  const base = applyFilters(DATA.records, { allowedOffices: allowedOffices(), range: st.period, office: st.office });
  const sort = ["asc", "desc", "n", "name"].includes(st.params.sortierung) ? st.params.sortierung : "asc";
  const offices = st.office !== "Alle" ? [st.office] : allowedOffices();
  const all = starDist(base);
  const sorter = {
    asc: (a, b) => a.mean - b.mean,
    desc: (a, b) => b.mean - a.mean,
    n: (a, b) => b.n - a.n,
    name: (a, b) => a.service.localeCompare(b.service, "de"),
  }[sort];
  const groups = offices
    .map((office) => {
      const recs = base.filter((r) => r.office === office);
      const od = starDist(recs);
      const rows = serviceTable(recs, CATALOG.find((c) => c.office === office).services);
      const reliable = rows.filter((r) => r.reliable).sort(sorter);
      const low = rows.filter((r) => !r.reliable).sort((a, b) => b.n - a.n);
      return `<section class="card office-block">
        <div class="office-head">
          <h3 class="card-title">${esc(office)}</h3>
          <span>${od.showable ? `Ø ${fmtMean(od.mean)} ${starsHtml(od.mean)}` : "–"} · N = ${fmtInt(od.valid)} ${lowNBadge(od.valid)}</span>
          <a class="btn-mini" href="${href("start", { dienststelle: office, service: "" })}">Übersicht dieser Dienststelle</a>
        </div>
        <div class="svc-compare">${[...reliable, ...low].map((r) => serviceDotRow(r, all.mean)).join("")}</div>
        ${dotAxis()}
        <details class="table-alt"><summary>Werte als Tabelle</summary>
          <table><thead><tr><th scope="col">Service</th><th scope="col">Ø Sterne</th><th scope="col">N</th><th scope="col">Positiv (4–5)</th><th scope="col">Kritisch (1–2)</th><th scope="col">Hinweis</th></tr></thead>
          <tbody>${[...reliable, ...low].map((r) => `<tr><td>${esc(r.service)}</td><td>${r.showable ? fmtMean(r.mean) : "–"}</td><td>${fmtInt(r.n)}</td><td>${r.showable ? fmtPct(r.positive) : "–"}</td><td>${r.showable ? fmtPct(r.critical) : "–"}</td><td>${r.reliable ? "" : r.showable ? "geringe Fallzahl" : "zu wenige Antworten"}</td></tr>`).join("")}</tbody></table>
        </details>
      </section>`;
    })
    .join("");
  return `
    <div class="view-head">
      <div>
        <h2 class="view-title">Services &amp; Dienststellen</h2>
        <p class="view-desc">Vergleich der Online-Services anhand der Ø-Sternebewertung und Fallzahl, gegliedert nach Dienststellen. Es werden Services verglichen, keine Personen.</p>
        ${contextBar({ ...st, service: "Alle" }, base.length, all.valid)}
      </div>
      <label class="sort-label">Sortierung
        <select data-action="svc-sort">
          <option value="asc" ${sort === "asc" ? "selected" : ""}>Ø Sterne – niedrigste zuerst</option>
          <option value="desc" ${sort === "desc" ? "selected" : ""}>Ø Sterne – höchste zuerst</option>
          <option value="n" ${sort === "n" ? "selected" : ""}>Fallzahl – größte zuerst</option>
          <option value="name" ${sort === "name" ? "selected" : ""}>Name (A–Z)</option>
        </select>
      </label>
    </div>
    ${st.service !== "Alle" ? `<p class="notice">Hinweis: Der Service-Filter „${esc(st.service)}“ wird hier ignoriert, damit alle Services der Dienststelle vergleichbar bleiben.</p>` : ""}
    <p class="notice">Alle Werte auf derselben Skala von 1 bis 5 Sternen. Senkrechte Linie: Ø über alle angezeigten Services (${fmtMean(all.mean)}). Services mit weniger als ${MIN_N_RELIABLE} Bewertungen stehen unten und sind markiert. Zeile anklicken: zugrunde liegende Rückmeldungen.</p>
    ${groups}`;
}

/* ---------------- Ansicht: Einzelrückmeldungen (Drilldown) ---------------- */

function viewResponses(st) {
  let recs = baseFilter(st, st.period);
  const p = st.params;
  const ctx = [];
  if (p.svc && SERVICE_TO_OFFICE[p.svc]) {
    recs = recs.filter((r) => r.service === p.svc);
    ctx.push(`Service: ${p.svc}`);
  }
  const f = ratingFilters(p);
  recs = applyRatingFilters(recs, f);
  if (f.stars.length) ctx.push(`Sterne: ${f.stars.join(", ")}`);
  if (f.item && f.cat) ctx.push(`${ITEMS.find((i) => i.code === f.item).label}: ${AGREE_SCALE.groups[f.cat]?.label || "ohne Angabe"}`);
  const back = VIEWS[p.zurueck] ? p.zurueck : "start";
  return `
    <div class="view-head">
      <div>
        <a class="back-link" href="${href(back)}">← Zurück zu „${esc(VIEWS[back])}“</a>
        <h2 class="view-title">Einzelrückmeldungen</h2>
        ${ctx.length ? `<p class="view-desc">Auswahl: <b>${ctx.map(esc).join(" · ")}</b></p>` : ""}
        ${contextBar(st, recs.length)}
      </div>
    </div>
    ${p.svc ? `<section class="split">${(() => {
      const d = starDist(recs);
      return `<article class="card"><h3 class="card-title">Sterne</h3><div class="dist-summary">${d.showable ? `<span class="value">${fmtMean(d.mean)}</span> ${starsHtml(d.mean, "lg")}` : ""} <span class="muted">N = ${fmtInt(d.valid)}</span> ${lowNBadge(d.valid)}</div>${starColumns(d)}</article>
        <article class="card"><h3 class="card-title">Bewertete Aspekte</h3>${scaleLegend(AGREE_SCALE)}<div class="aspects compact">${ITEMS.map((it) => aspectRow(it, itemDist(recs, it.code), { compact: true })).join("")}</div></article>`;
    })()}</section>` : ""}
    ${responsesTable(recs, "Rückmeldungen")}`;
}

/* ---------------- Ansicht: Daten & Methodik ---------------- */

function viewData(st) {
  const all = DATA.records;
  const incomplete = all.filter((r) => !r.complete).length;
  const unassigned = all.filter((r) => r.complete && r.office === UNASSIGNED_OFFICE).length;
  return `
    <div class="view-head"><div>
      <h2 class="view-title">Daten &amp; Methodik</h2>
      <p class="view-desc">Datenquelle, Definitionen der Kennzahlen, Zuordnungen sowie Import und Export.</p>
    </div></div>

    <section class="card">
      <h3 class="card-title">Datenquelle</h3>
      <dl class="kv">
        <dt>Quelle</dt><dd>${DATA.source === "sample" ? `<span class="flag">Beispieldaten</span> fiktiv erzeugt, ohne personenbezogene Angaben` : `Import: ${esc(DATA.fileName)} (nur in diesem Browser-Tab, wird nicht gespeichert oder übertragen)`}</dd>
        <dt>Stand</dt><dd>${esc(DATA.lastUpdated)}</dd>
        <dt>Datensätze</dt><dd>${fmtInt(all.length)} gesamt · ${fmtInt(all.length - incomplete)} abgeschlossen · ${fmtInt(incomplete)} nicht abgeschlossen (nicht ausgewertet)</dd>
        <dt>Ohne Dienststelle</dt><dd>${fmtInt(unassigned)} Rückmeldungen mit Service ohne Katalog-Zuordnung</dd>
      </dl>
      <div class="import">
        <label class="btn secondary file-btn">CSV-Export des Fragebogens laden
          <input type="file" accept=".csv,text/csv" id="csv-input" />
        </label>
        ${DATA.source !== "sample" ? `<button class="btn ghost" data-action="use-sample">Zurück zu Beispieldaten</button>` : ""}
        <p class="muted">Erwartet: Spaltenüberschriften „Feldcode + Fragetext“ (z. B. <code>G02Q03[SQ002]. Die einzelnen …</code>). Antwortwerte 1–5, „A1“–„A5“ oder die Textlabels der Zustimmungsskala werden erkannt.</p>
        <div id="import-msg" role="status"></div>
      </div>
    </section>

    <section class="card" id="definitionen">
      <h3 class="card-title">Definitionen der Kennzahlen</h3>
      <table>
        <thead><tr><th scope="col">Kennzahl</th><th scope="col">Berechnung</th><th scope="col">Nenner</th></tr></thead>
        <tbody>
          <tr><td>Grundgesamtheit (N)</td><td>Abgeschlossene Fragebögen (Abgabedatum <code>submitdate</code> vorhanden) im Zeitraum und Filter</td><td>–</td></tr>
          <tr><td>Ø Gesamtzufriedenheit</td><td>Mittelwert der Sterne 1–5 aus <code>G01Q02</code></td><td>Rückmeldungen mit Sternebewertung</td></tr>
          <tr><td>Positive Bewertungen</td><td>Anteil 4 oder 5 Sterne (früher „Top-2-Box“)</td><td>Rückmeldungen mit Sternebewertung</td></tr>
          <tr><td>Mittlere Bewertungen</td><td>Anteil 3 Sterne</td><td>Rückmeldungen mit Sternebewertung</td></tr>
          <tr><td>Kritische Bewertungen</td><td>Anteil 1 oder 2 Sterne (früher „Bottom-2-Box“)</td><td>Rückmeldungen mit Sternebewertung</td></tr>
          <tr><td>Zustimmung / Ablehnung</td><td>Anteil „stimme eher zu“ + „stimme voll und ganz zu“ bzw. „stimme überhaupt nicht zu“ + „stimme eher nicht zu“ je Aussage <code>G02Q03[…]</code></td><td>Antworten auf diese Aussage (ohne „keine Angabe“)</td></tr>
          <tr><td>Veränderung</td><td>Differenz zum unmittelbar vorhergehenden Zeitraum gleicher Länge; Anteile in Prozentpunkten</td><td>wie oben, je Zeitraum</td></tr>
          <tr><td>Geringe Fallzahl</td><td>Hinweis unter ${MIN_N_RELIABLE} Antworten; unter ${MIN_N_SHOW} Antworten keine Werte</td><td>–</td></tr>
        </tbody>
      </table>
      <p class="muted">Prozentwerte werden so gerundet, dass eine Verteilung genau 100 % ergibt und Gruppen (z. B. 4 + 5 Sterne) der Summe der Einzelwerte entsprechen. Fehlende Antworten werden nie als 0 Sterne gezählt. Zusammenhänge zwischen Werten sind keine nachgewiesenen Ursachen.</p>
    </section>

    <section class="card">
      <h3 class="card-title">Fragen und Kurzbezeichnungen</h3>
      <table><thead><tr><th scope="col">Feldcode</th><th scope="col">Kurzbezeichnung im Dashboard</th><th scope="col">Fragetext</th></tr></thead>
      <tbody>
        <tr><td><code>Q00</code></td><td>Online-Service</td><td>${esc(QUESTION_TEXT.Q00)}</td></tr>
        <tr><td><code>G01Q02</code></td><td>Gesamtzufriedenheit (Sterne)</td><td>${esc(QUESTION_TEXT.G01Q02)}</td></tr>
        ${ITEMS.map((i) => `<tr><td><code>${esc(i.field)}</code></td><td>${esc(i.label)}</td><td>${esc(i.text)}</td></tr>`).join("")}
        <tr><td><code>G01Q04</code></td><td>Textfeedback: Kritik</td><td>${esc(QUESTION_TEXT.G01Q04)}</td></tr>
        <tr><td><code>G01Q05</code></td><td>Textfeedback: Lob</td><td>${esc(QUESTION_TEXT.G01Q05)}</td></tr>
      </tbody></table>
      <p class="muted">Die Kurzbezeichnungen sind aus dem Fragetext abgeleitet und noch fachlich zu bestätigen.</p>
    </section>

    <section class="card">
      <h3 class="card-title">Zuordnung Online-Service → Dienststelle <span class="flag">Beispiel</span></h3>
      <table><thead><tr><th scope="col">Dienststelle</th><th scope="col">Online-Services</th></tr></thead>
      <tbody>${CATALOG.map((c) => `<tr><td>${esc(c.office)}</td><td>${c.services.map(esc).join(", ")}</td></tr>`).join("")}</tbody></table>
    </section>

    <section class="card" id="themen">
      <h3 class="card-title">Themen und Stichwörter (Verbesserungspotenziale)</h3>
      <table><thead><tr><th scope="col">Thema</th><th scope="col">Stichwörter (Teilwort, Groß-/Kleinschreibung egal)</th></tr></thead>
      <tbody>${THEMES.map((t) => `<tr><td>${esc(t.label)}</td><td>${t.keywords.map(esc).join(", ")}</td></tr>`).join("")}</tbody></table>
    </section>

    <section class="card">
      <h3 class="card-title">Export der aktuellen Filterung</h3>
      <p>Zeitraum ${esc(st.period.rangeText)}, ${st.office === "Alle" ? "alle Dienststellen" : esc(st.office)}${st.service !== "Alle" ? `, ${esc(st.service)}` : ""}: <b>${fmtInt(baseFilter(st, st.period).length)}</b> Rückmeldungen.</p>
      <div class="export-actions">
        <button class="btn" data-action="export-csv">CSV herunterladen</button>
      </div>
    </section>`;
}

/* ---------------- Detailansicht (Modal) ---------------- */

function openDetail(id) {
  const r = DATA.records.find((x) => x.id === id);
  if (!r) return;
  const items = ITEMS.map((it) => {
    const v = r.items[it.code];
    return `<tr>
      <th scope="row">${esc(it.label)}<br><small class="muted">${esc(it.text)}</small></th>
      <td>${
        v == null
          ? `<span class="muted">keine Angabe</span>`
          : `<span class="cat-chip" style="background:${SCALE_COLORS[v]};color:${SCALE_TEXT_ON[v]}">${v}</span> ${esc(AGREE_SCALE.labels[v])}`
      }</td>
    </tr>`;
  }).join("");
  const grp = r.stars == null ? null : Object.values(STAR_SCALE.groups).find((g) => g.values.includes(r.stars));
  openModal(
    `Rückmeldung vom ${fmtDate(r.date)}`,
    `<dl class="kv">
      <dt>Online-Service</dt><dd>${esc(r.service || "–")}</dd>
      <dt>Dienststelle</dt><dd>${esc(r.office)}</dd>
      <dt>Abgegeben am</dt><dd>${fmtDate(r.submitted)}</dd>
      <dt>Antwort-ID</dt><dd>${esc(r.id)}</dd>
    </dl>
    <section class="detail-sec">
      <h3 class="card-title">Bewertung</h3>
      <p><b>Gesamtzufriedenheit:</b> ${starsExact(r.stars)} ${r.stars != null ? `${r.stars} von 5 · ${esc(grp.label)}` : ""}</p>
      <table class="detail-items"><tbody>${items}</tbody></table>
    </section>
    <section class="detail-sec">
      <h3 class="card-title">Textfeedback derselben Rückmeldung</h3>
      <p class="muted">Kritik – „${esc(QUESTION_TEXT.G01Q04)}“</p>
      <div class="comment-box ${r.textNegative ? "neg" : "empty-box"}">${r.textNegative ? esc(r.textNegative) : "Kein Text (nicht beantwortet oder Frage nicht angezeigt)."}</div>
      <p class="muted">Lob – „${esc(QUESTION_TEXT.G01Q05)}“</p>
      <div class="comment-box ${r.textPositive ? "pos" : "empty-box"}">${r.textPositive ? esc(r.textPositive) : "Kein Text (nicht beantwortet oder Frage nicht angezeigt)."}</div>
    </section>`
  );
}

function openModal(title, html) {
  ui.lastFocus = document.activeElement;
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  $("#modal").hidden = false;
  document.body.classList.add("modal-open");
  $("#modal-close").focus();
}

function closeModal() {
  if ($("#modal").hidden) return;
  $("#modal").hidden = true;
  document.body.classList.remove("modal-open");
  if (ui.lastFocus && document.contains(ui.lastFocus)) ui.lastFocus.focus();
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 7000);
}

/* ---------------- Globale Filterleiste ---------------- */

function renderFilters(st) {
  const role = currentRole();
  $("#filter-period").innerHTML = DATA.periods.map((p) => `<option value="${p.id}" ${p.id === st.period.id ? "selected" : ""}>${esc(p.label)}</option>`).join("");
  const offices = allowedOffices();
  const officeSel = $("#filter-office");
  officeSel.innerHTML = (role.offices ? [] : [`<option value="Alle">Alle Dienststellen</option>`])
    .concat(offices.map((o) => `<option ${o === st.office ? "selected" : ""}>${esc(o)}</option>`))
    .join("");
  officeSel.disabled = !!role.offices;
  officeSel.title = role.offices ? "Durch die Demo-Rolle festgelegt" : "";
  const groups = CATALOG.filter((c) => (st.office === "Alle" ? offices.includes(c.office) : c.office === st.office));
  $("#filter-service").innerHTML =
    `<option value="Alle">${st.office === "Alle" ? "Alle Services" : `Alle Services (${esc(st.office)})`}</option>` +
    groups
      .map((g) => `<optgroup label="${esc(g.office)}">${g.services.map((s) => `<option ${s === st.service ? "selected" : ""}>${esc(s)}</option>`).join("")}</optgroup>`)
      .join("");
  $("#updated-at").textContent = DATA.lastUpdated;

  const chips = [];
  if (st.office !== "Alle" && !role.offices) chips.push(`<span class="fchip">Dienststelle: ${esc(st.office)} <button data-action="clear-filter" data-key="dienststelle" aria-label="Filter Dienststelle entfernen">×</button></span>`);
  if (role.offices) chips.push(`<span class="fchip locked">Dienststelle: ${esc(st.office)} <small>(Demo-Rolle)</small></span>`);
  if (st.service !== "Alle") chips.push(`<span class="fchip">Service: ${esc(st.service)} <button data-action="clear-filter" data-key="service" aria-label="Filter Service entfernen">×</button></span>`);
  const nonDefault = st.period.id !== DATA.periods[0].id || chips.some((c) => !c.includes("locked"));
  if (st.period.id !== DATA.periods[0].id) chips.unshift(`<span class="fchip">Zeitraum: ${esc(st.period.rangeText)} <button data-action="clear-filter" data-key="zeitraum" aria-label="Zeitraum zurücksetzen">×</button></span>`);
  $("#active-filters").innerHTML = chips.length
    ? `<span class="af-label">Aktive Filter (gelten im ganzen Dashboard):</span> ${chips.join("")} ${nonDefault ? `<button class="btn-mini" data-action="reset-filters">Alle Filter zurücksetzen</button>` : ""}`
    : `<span class="af-label">Keine zusätzlichen Filter – Zeitraum: ${esc(st.period.rangeText)}, alle Dienststellen und Services.</span>`;

  $("#demo-role").innerHTML = DEMO_ROLES.map((r) => `<option value="${esc(r.id)}" ${r.id === role.id ? "selected" : ""}>${esc(r.label)}</option>`).join("");
  $("#data-source").innerHTML = DATA.source === "sample" ? "Beispieldaten (fiktiv)" : `Import: ${esc(DATA.fileName)}`;
}

/* ---------------- Rendern ---------------- */

let lastViewKey = "";

function render() {
  const st = getState();
  const viewKey = st.view + JSON.stringify(st.params);
  if (viewKey !== lastViewKey) {
    ui.tablePage = 1;
    if (!lastViewKey.startsWith(st.view)) ui.textSearch = "";
  }
  lastViewKey = viewKey;
  renderFilters(st);
  $$(".nav-item").forEach((a) => {
    const active = a.dataset.view === st.view || (st.view === "rueckmeldungen" && a.dataset.view === st.params.zurueck);
    a.classList.toggle("is-active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
    a.href = href(a.dataset.view);
  });
  $(".brand a").href = href("start");
  $(".mobile-logo-link").href = href("start");
  const views = { start: viewStart, bewertungen: viewRatings, textfeedback: viewTexts, services: viewServices, rueckmeldungen: viewResponses, daten: viewData };
  const root = $("#view-root");
  try {
    root.innerHTML = views[st.view](st);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="card error" role="alert"><h2 class="card-title">Die Ansicht konnte nicht geladen werden.</h2><p>${esc(err.message)}</p><a class="btn" href="#/start">Zur Übersicht</a></div>`;
  }
  document.title = `${VIEWS[st.view]} · Bürgerfeedback Online-Services · Prototyp`;
}

function updateParams(changes, { resetLocal = false } = {}) {
  const { view, params } = parseHash();
  let next = { ...params, ...changes };
  if (resetLocal) next = Object.fromEntries(Object.entries(next).filter(([k]) => GLOBAL_KEYS.includes(k)));
  location.hash = buildHash(view, next);
}

/* ---------------- Ereignisse ---------------- */

function moveTile(id, dir) {
  const layout = loadLayout();
  const i = layout.findIndex((t) => t.id === id);
  const j = i + dir;
  if (j < 0 || j >= layout.length) return;
  [layout[i], layout[j]] = [layout[j], layout[i]];
  saveLayout(layout);
  render();
  const btn = $(`[data-action="tile-move"][data-id="${id}"][data-dir="${dir}"]`) || $(`[data-action="tile-move"][data-id="${id}"]:not([disabled])`);
  btn?.focus();
  announce(`${TILES[id].title} ist jetzt an Position ${j + 1} von ${layout.length}.`);
}

function announce(msg) {
  $("#sr-status").textContent = msg;
}

function exportCsv() {
  const st = getState();
  const recs = baseFilter(st, st.period);
  const head = ["id", "submitdate", "Q00", "Dienststelle", "G01Q02", ...ITEMS.map((i) => i.field), "G01Q04", "G01Q05"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = recs.map((r) =>
    [r.id, r.submitted ? r.submitted.toISOString() : "", r.service, r.office, r.stars ?? "", ...ITEMS.map((i) => r.items[i.code] ?? ""), r.textNegative, r.textPositive].map(q).join(";")
  );
  const blob = new Blob(["﻿" + [head.map(q).join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `feedback-${st.period.id}${DATA.source === "sample" ? "-beispieldaten" : ""}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function handleImport(file) {
  const msg = $("#import-msg");
  msg.innerHTML = `<p>Datei wird gelesen …</p>`;
  const reader = new FileReader();
  reader.onerror = () => (msg.innerHTML = `<p class="error-text">Die Datei konnte nicht gelesen werden.</p>`);
  reader.onload = () => {
    try {
      const res = importCsv(String(reader.result));
      const dated = res.records.filter((r) => r.date);
      if (!dated.length) throw new Error("Keine gültigen Datumsangaben gefunden.");
      const max = new Date(Math.max(...dated.map((r) => r.date)));
      const lastFull = new Date(max.getFullYear(), max.getMonth() + 1, 0).getDate() === max.getDate() ? max : new Date(max.getFullYear(), max.getMonth(), 0);
      DATA.records = res.records;
      DATA.source = "import";
      DATA.fileName = file.name;
      DATA.lastUpdated = `Datenstand ${fmtDate(max)}`;
      DATA.periods = buildPeriods(lastFull);
      render();
      $("#import-msg").innerHTML = `<p class="ok-text">${fmtInt(res.records.length)} Datensätze geladen. Erkannte Aussagen: ${res.foundItems.join(", ") || "keine"}.</p>${
        res.unknownServices.length ? `<p class="error-text">Services ohne Dienststellen-Zuordnung (als „${UNASSIGNED_OFFICE}“ geführt): ${res.unknownServices.map(esc).join(", ")}</p>` : ""
      }`;
    } catch (e) {
      msg.innerHTML = `<p class="error-text">Import fehlgeschlagen: ${esc(e.message)}</p>`;
    }
  };
  reader.readAsText(file, "utf-8");
}

function bind() {
  window.addEventListener("hashchange", () => {
    closeModal();
    render();
    if (!location.hash.includes("#definitionen") && !location.hash.includes("#themen")) {
      $("#view-root").scrollIntoView ? window.scrollTo({ top: 0 }) : null;
    }
  });

  $("#filter-period").addEventListener("change", (e) => updateParams({ zeitraum: e.target.value }));
  $("#filter-office").addEventListener("change", (e) => {
    const { params } = parseHash();
    const office = e.target.value;
    const changes = { dienststelle: office };
    if (params.service && office !== "Alle" && SERVICE_TO_OFFICE[params.service] !== office) {
      changes.service = "";
      toast(`Service-Auswahl „${params.service}“ zurückgesetzt, weil der Service nicht zur Dienststelle „${office}“ gehört.`);
    }
    updateParams(changes);
  });
  $("#filter-service").addEventListener("change", (e) => updateParams({ service: e.target.value }));
  $("#demo-role").addEventListener("change", (e) => {
    localStorage.setItem(ROLE_KEY, e.target.value);
    const role = currentRole();
    toast(role.offices ? `Demo-Rolle gewechselt: Es werden nur Daten der Dienststelle „${role.offices[0]}“ angezeigt.` : "Demo-Rolle gewechselt: Zentrale Gesamtansicht aller Dienststellen.");
    const { view, params } = parseHash();
    const next = { ...params };
    if (!role.offices) delete next.dienststelle;
    location.hash = buildHash(view, next);
    render();
  });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.tagName === "SELECT") return;
    const a = el.dataset.action;
    const { params } = parseHash();
    if (a === "detail") openDetail(el.dataset.id);
    else if (a === "toggle-star") {
      const cur = params.sterne ? params.sterne.split(",") : [];
      const s = el.dataset.star;
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      updateParams({ sterne: next.sort().join(",") });
    } else if (a === "rf-reset") updateParams({ sterne: "", aussage: "", kategorie: "" });
    else if (a === "clear-filter") {
      updateParams({ [el.dataset.key]: "" });
    } else if (a === "reset-filters") {
      const { view } = parseHash();
      location.hash = buildHash(view, {});
      toast("Alle globalen Filter wurden zurückgesetzt.");
    } else if (a === "toggle-customize") {
      ui.customize = !ui.customize;
      render();
      $('[data-action="toggle-customize"]')?.focus();
    } else if (a === "reset-layout") {
      localStorage.removeItem(LAYOUT_KEY);
      render();
      announce("Standardansicht wiederhergestellt.");
      toast("Standardansicht der Kacheln wiederhergestellt.");
    } else if (a === "tile-move") moveTile(el.dataset.id, Number(el.dataset.dir));
    else if (a === "more-rows") {
      ui.tablePage += 1;
      render();
    } else if (a === "export-csv") exportCsv();
    else if (a === "use-sample") {
      DATA.records = SAMPLE_RECORDS;
      DATA.source = "sample";
      DATA.fileName = "";
      DATA.lastUpdated = SAMPLE_LAST_UPDATED;
      DATA.periods = buildPeriods(DATA_END);
      render();
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.id === "csv-input" && el.files[0]) return handleImport(el.files[0]);
    const a = el.dataset.action;
    if (a === "tile-size") {
      const layout = loadLayout();
      layout.find((t) => t.id === el.dataset.id).size = el.value;
      saveLayout(layout);
      render();
      $(`[data-action="tile-size"][data-id="${el.dataset.id}"]`)?.focus();
    } else if (a === "rf-item") updateParams({ aussage: el.value, kategorie: el.value ? parseHash().params.kategorie || "positive" : "" });
    else if (a === "rf-cat") updateParams({ kategorie: el.value });
    else if (a === "svc-sort") updateParams({ sortierung: el.value });
  });

  document.addEventListener("input", (e) => {
    if (e.target.id !== "text-search") return;
    ui.textSearch = e.target.value;
    ui.tablePage = 1;
    const st = getState();
    // Nur die Ergebnisliste neu zeichnen, damit der Fokus im Suchfeld bleibt.
    const tmp = document.createElement("div");
    tmp.innerHTML = viewTexts(st);
    $("#text-results").innerHTML = $("#text-results", tmp).innerHTML;
  });

  /* Drag & Drop der Kacheln (Alternative: Schaltflächen „Nach vorne/hinten“) */
  document.addEventListener("dragstart", (e) => {
    const tile = e.target.closest?.(".tile");
    if (!tile || !ui.customize) return;
    ui.dragId = tile.dataset.tile;
    tile.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ui.dragId);
  });
  document.addEventListener("dragover", (e) => {
    const tile = e.target.closest?.(".tile");
    if (!tile || !ui.dragId) return;
    e.preventDefault();
    $$(".tile.drop-target").forEach((t) => t.classList.remove("drop-target"));
    if (tile.dataset.tile !== ui.dragId) tile.classList.add("drop-target");
  });
  document.addEventListener("drop", (e) => {
    const tile = e.target.closest?.(".tile");
    if (!tile || !ui.dragId) return;
    e.preventDefault();
    const layout = loadLayout();
    const from = layout.findIndex((t) => t.id === ui.dragId);
    const to = layout.findIndex((t) => t.id === tile.dataset.tile);
    const [moved] = layout.splice(from, 1);
    layout.splice(to, 0, moved);
    saveLayout(layout);
    ui.dragId = null;
    render();
    announce(`${TILES[moved.id].title} verschoben.`);
  });
  document.addEventListener("dragend", () => {
    ui.dragId = null;
    $$(".tile").forEach((t) => t.classList.remove("dragging", "drop-target"));
  });

  $("#info-btn").addEventListener("click", () =>
    openModal(
      "Hinweise zum Dashboard",
      `<ul class="help-list">
        <li><b>Zweck:</b> Rückmeldungen zu Online-Services auswerten, um Services zu verbessern und Gutes sichtbar zu machen. Es werden Services bewertet, keine Personen.</li>
        <li><b>Globale Filter</b> (Zeitraum, Dienststelle, Service) oben gelten auf allen Seiten und bleiben beim Seitenwechsel erhalten.</li>
        <li><b>Bereichsfilter</b> (z. B. Sterne unter „Bewertungen“) gelten nur im jeweiligen Bereich.</li>
        <li><b>Bewertungen</b> = Sterne und Zustimmungsskalen. <b>Textfeedback</b> = offene Kommentare.</li>
        <li>Karten, Balken, Themen und Services sind anklickbar und führen zu den zugrunde liegenden Rückmeldungen. Das Logo führt zurück zur Übersicht.</li>
        <li><b>Demo-Rolle</b> (Seitenleiste) simuliert Zugriffsrechte einer Dienststelle. Es gibt keine echte Anmeldung.</li>
        <li>Das Feedback ist freiwillig und nicht repräsentativ für alle Bürgerinnen und Bürger.</li>
      </ul>
      <p><a href="#/daten">Definitionen und Methodik</a></p>`
    )
  );
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if ($("#modal").hidden) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab") {
      const f = $$("#modal button, #modal a[href], #modal summary, #modal select, #modal input").filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

bind();
render();
