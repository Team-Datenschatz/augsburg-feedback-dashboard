/* =====================================================================
   Oberfläche des Bürgerfeedback-Dashboards.
   - Feste Standardansicht (keine individuelle Layoutanpassung).
   - Zustand (Ansicht + Filter) steht in der URL (#/ansicht?zeitraum=…):
     Filter bleiben beim Wechsel erhalten, der Zurück-Button funktioniert.
   - Globale Filter (Zeitraum, Dienststelle, Service) gelten überall.
   - In der Bewertungsübersicht filtert ein Klick auf Balken/Säulen
     (lokaler Filter, wird zu den Einzelbewertungen mitgenommen).
   - Längere Erklärungen stecken in einheitlichen Info-Elementen (i).
   - Die Demo-Rolle simuliert Zugriffsrechte, getrennt von Ansichtsfiltern.
   ===================================================================== */

const VIEWS = {
  start: "Übersicht",
  bewertungen: "Bewertungsübersicht",
  einzelbewertungen: "Einzelbewertungen",
  textfeedback: "Textfeedback",
  services: "Services",
  daten: "Daten & Methodik",
};
const VIEW_ALIASES = { rueckmeldungen: "einzelbewertungen" };
const GLOBAL_KEYS = ["zeitraum", "dienststelle", "service"];
const ROLE_KEY = "afd.demoRolle.v1";
const PAGE_SIZE = 25;
const TEXT_PAGE_SIZE = 8;

/* Kurzbeschriftungen der Zustimmungsskala unter den Säulen („Ich stimme … zu“). */
const AGREE_SHORT = { 1: "gar nicht", 2: "eher nicht", 3: "teils/ teils", 4: "eher", 5: "voll und ganz" };

const DATA = {
  records: SAMPLE_RECORDS,
  source: "sample",
  fileName: "",
  lastUpdated: SAMPLE_LAST_UPDATED,
  periods: buildPeriods(DATA_END),
};

const ui = {
  textSearch: "",
  tablePage: 1,
  textPages: { lob: 1, kritik: 1 },
  lastFocus: null,
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
  const r = Number(Math.abs(n).toFixed(digits));
  if (r === 0) return "±0";
  return (n > 0 ? "+" : "−") + r.toFixed(digits).replace(".", ",");
}

/* Einheitliches Info-Element: Button öffnet/schließt eine kurze Erläuterung. */
let infoSeq = 0;
function info(html, label = "Erläuterung anzeigen") {
  const id = `info-${++infoSeq}`;
  return `<span class="info-wrap"><button type="button" class="info-btn" data-action="info" aria-expanded="false" aria-controls="${id}" aria-label="${esc(label)}">i</button><span class="info-pop" id="${id}" role="note" hidden>${html}</span></span>`;
}

/* ---------------- Routing / Zustand ---------------- */

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const p = VIEW_ALIASES[path] || path;
  const view = VIEWS[p] ? p : "start";
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

/* Prüft globale Filter und korrigiert widersprüchliche Kombinationen. */
function sanitizeGlobals(params) {
  const notes = [];
  const out = { ...params };
  if (!DATA.periods.some((p) => p.id === out.zeitraum)) out.zeitraum = DATA.periods[0].id;
  const role = currentRole();
  if (role.offices) {
    out.dienststelle = role.offices[0];
  } else if (out.dienststelle && out.dienststelle !== "Alle" && !OFFICES.includes(out.dienststelle)) {
    notes.push(`Dienststelle „${out.dienststelle}“ ist unbekannt – Filter zurückgesetzt.`);
    delete out.dienststelle;
  }
  if (out.service && out.service !== "Alle" && !allowedServices(out.dienststelle).includes(out.service)) {
    const owner = SERVICE_TO_OFFICE[out.service];
    notes.push(
      owner
        ? `Service „${out.service}“ zurückgesetzt: Er gehört zur Dienststelle „${owner}“.`
        : `Service „${out.service}“ ist unbekannt – Filter zurückgesetzt.`
    );
    delete out.service;
  }
  return { params: out, notes };
}

function getState() {
  const { view, params } = parseHash();
  const { params: p, notes } = sanitizeGlobals(params);
  if (GLOBAL_KEYS.some((k) => (p[k] || "") !== (params[k] || ""))) history.replaceState(null, "", buildHash(view, p));
  notes.forEach(toast);
  return {
    view,
    params: p,
    period: DATA.periods.find((x) => x.id === p.zeitraum),
    office: p.dienststelle || "Alle",
    service: p.service || "Alle",
  };
}

function baseFilter(st, range) {
  return applyFilters(DATA.records, { allowedOffices: allowedOffices(), range, office: st.office, service: st.service });
}

function isDefaultGlobal(st) {
  return st.period.id === DATA.periods[0].id && (st.office === "Alle" || !!currentRole().offices) && st.service === "Alle";
}

/* ---------------- Bausteine ---------------- */

function starsHtml(mean, size = "") {
  if (mean == null) return "";
  const pct = Math.max(0, Math.min(100, (mean / 5) * 100));
  return `<span class="stars ${size}" role="img" aria-label="${fmtMean(mean)} von 5 Sternen"><span class="stars-bg" aria-hidden="true">★★★★★</span><span class="stars-fg" style="width:${pct}%" aria-hidden="true">★★★★★</span></span>`;
}

function starsExact(v) {
  if (v == null) return `<span class="muted">keine Angabe</span>`;
  return `<span class="stars-exact" role="img" aria-label="${v} von 5 Sternen"><span aria-hidden="true">${"★".repeat(v)}<span class="off">${"★".repeat(5 - v)}</span></span></span>`;
}

function lowNBadge(n) {
  if (n < MIN_N_SHOW) return `<span class="flag flag-none">⚠ zu wenige Antworten</span>`;
  if (n < MIN_N_RELIABLE) return `<span class="flag">⚠ wenige Antworten</span>`;
  return "";
}

function deltaHtml(value, unit, st, { higherIsBetter = true, reliable = true } = {}) {
  if (value == null) return `<p class="delta delta-none">Kein Vergleich möglich</p>`;
  const digits = unit === "Pp." ? 0 : 1;
  const r = Number(value.toFixed(digits));
  const arrow = r > 0 ? "▲" : r < 0 ? "▼" : "→";
  const cls = r === 0 ? "delta-flat" : (r > 0) === higherIsBetter ? "delta-good" : "delta-bad";
  const unitTxt = unit === "Pp." ? " Pp." : "";
  return `<p class="delta ${cls}"><span aria-hidden="true">${arrow}</span> ${signed(value, digits)}${unitTxt} ggü. ${esc(st.period.prevLabel)}${reliable ? "" : " · unsicher"}</p>`;
}

function scopeText(st) {
  if (st.service !== "Alle") return esc(st.service);
  if (st.office !== "Alle") return esc(st.office);
  return "Alle Dienststellen";
}

/* Kopfzeile jeder Seite: kurze Überschrift + kompakter Kontext (Zeitraum, Bereich, N). */
function pageHead(st, title, n, { actions = "", back = "" } = {}) {
  return `<div class="page-head">
    <div class="page-head-main">
      ${back}
      <h2 class="page-title">${esc(title)}</h2>
      <p class="context"><span>${esc(st.period.rangeText)}</span><span>${scopeText(st)}</span><span><b>N = ${fmtInt(n)}</b> Rückmeldungen</span>${info(
        `<b>N</b> = abgeschlossene Fragebögen im gewählten Zeitraum und Filter.<br>Vergleichszeitraum: ${esc(st.period.prevLabel)}.<br>Freiwilliges Feedback nach Nutzung – nicht repräsentativ für alle Augsburger Bürgerinnen und Bürger. Zusammenhänge sind keine nachgewiesenen Ursachen.`,
        "Erläuterung zur Datengrundlage"
      )}</p>
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ""}
  </div>`;
}

/* Kompakte Sterneverteilung nach dem Vorbild von Google/Amazon: 5 ★ oben bis 1 ★ unten.
   „Ohne Angabe“ ist keine eigene Kategorie; Bezug sind nur gültige Bewertungen. */
function starBars(d, { linkTo = null, selected = [], clickable = false } = {}) {
  const max = Math.max(1, ...d.pct.map((p) => p || 0));
  const rows = [5, 4, 3, 2, 1]
    .map((v) => {
      const p = d.pct[v - 1] ?? 0;
      const c = d.counts[v - 1];
      const isSel = selected.includes(String(v));
      const dim = selected.length && !isSel;
      const inner = `<span class="sb-label">${v} ★</span>
        <span class="sb-track"><span class="sb-fill" style="width:${(p / max) * 100}%;background:${SCALE_COLORS[v]}"></span></span>
        <span class="sb-val"><b>${d.valid ? fmtPct(p) : "–"}</b> <small>(${fmtInt(c)})</small></span>`;
      const label = `${v} Sterne: ${d.valid ? p + " Prozent" : "keine Daten"}, ${c} Bewertungen`;
      if (linkTo) return `<a class="sb-row" href="${linkTo(v)}" aria-label="${label} – Bewertungen anzeigen">${inner}</a>`;
      if (clickable)
        return `<button type="button" class="sb-row ${dim ? "dim" : ""}" data-action="toggle-star" data-star="${v}" aria-pressed="${isSel}" aria-label="${label} – filtern">${inner}</button>`;
      return `<div class="sb-row">${inner}</div>`;
    })
    .join("");
  return `<div class="star-bars" role="group" aria-label="Verteilung der Sternebewertungen">${rows}</div>`;
}

function starSummary(d) {
  return `<div class="star-summary">
    <span class="big-value">${d.showable ? fmtMean(d.mean) : "–"}</span>
    <span class="star-summary-side">${starsHtml(d.showable ? d.mean : null, "lg")}<span class="muted">${fmtInt(d.valid)} Bewertungen ${lowNBadge(d.valid)}</span></span>
  </div>`;
}

function groupLine(d) {
  const g = d.groups;
  return `<p class="group-line"><span>Positiv (4–5 ★) <b>${fmtPct(g.positive.pct)}</b></span><span>Mittel (3 ★) <b>${fmtPct(g.neutral.pct)}</b></span><span>Kritisch (1–2 ★) <b>${fmtPct(g.critical.pct)}</b></span></p>`;
}

function missingNote(d, what = "Sternebewertung") {
  return `Prozentwerte beziehen sich auf ${fmtInt(d.valid)} Rückmeldungen mit ${what}. ${fmtInt(d.missing)} Rückmeldungen ohne Angabe sind darin nicht enthalten und keiner Kategorie zugerechnet.`;
}

/* Waagerechte Balken für Ø Sterne je Service – feste Skala 0–5 Sterne. */
function serviceBars(rows, { showOffice = false } = {}) {
  if (!rows.length) return `<p class="empty">Keine Services mit ausreichender Fallzahl.</p>`;
  return `<div class="svc-bars" role="list">${rows
    .map(
      (r) => `<a role="listitem" class="svc-bar ${r.reliable ? "" : "is-low"}" href="${href("bewertungen", { dienststelle: r.office, service: r.service })}" aria-label="${esc(r.service)}: Ø ${fmtMean(r.mean)} von 5 Sternen, ${r.n} Bewertungen – Bewertungsübersicht öffnen">
        <span class="svc-bar-name">${esc(r.service)}${showOffice ? `<small>${esc(r.office)}</small>` : ""}</span>
        <span class="svc-bar-track">${r.showable ? `<span class="svc-bar-fill" style="width:${(r.mean / 5) * 100}%"></span>` : ""}</span>
        <span class="svc-bar-val"><b>${r.showable ? fmtMean(r.mean) + " ★" : "–"}</b><small>N = ${fmtInt(r.n)}</small></span>
        ${r.reliable ? "" : `<span class="svc-bar-flag">${lowNBadge(r.n)}</span>`}
      </a>`
    )
    .join("")}</div>
    <div class="svc-axis" aria-hidden="true"><span></span><span class="svc-axis-ticks">${[0, 1, 2, 3, 4, 5].map((v) => `<i style="left:${v * 20}%">${v}</i>`).join("")}</span><span class="svc-axis-unit">Ø Sterne</span></div>`;
}

/* ---------------- Ansicht: Übersicht ---------------- */

function viewStart(st) {
  const cur = baseFilter(st, st.period);
  const prev = baseFilter(st, st.period.prev);
  const d = starDist(cur);
  const cmp = compareDist(d, starDist(prev));
  const success = itemDist(cur, "SQ001");
  const successPrev = itemDist(prev, "SQ001");
  const successDelta = success.showable && successPrev.showable ? success.groups.positive.pct - successPrev.groups.positive.pct : null;
  const aspects = ITEMS.map((it) => ({ it, d: itemDist(cur, it.code) })).filter((a) => a.d.reliable);

  return `
    ${pageHead(st, "Übersicht", cur.length)}

    <section class="hero" aria-label="Kennzahlen">
      <article class="card card-hero">
        <div class="card-head"><h3 class="card-title"><a class="stretched" href="${href("bewertungen")}">Gesamtzufriedenheit</a></h3>${info(
          `„${esc(QUESTION_TEXT.G01Q02)}“<br>${missingNote(d)}`,
          "Erläuterung zur Gesamtzufriedenheit"
        )}</div>
        ${starSummary(d)}
        ${deltaHtml(cmp ? cmp.mean : null, "", st, { reliable: cmp?.reliable })}
        ${starBars(d, { linkTo: (v) => href("bewertungen", { sterne: String(v) }) })}
      </article>

      <div class="kpi-stack">
        <article class="card kpi kpi-primary">
          <div class="card-head"><h3 class="card-title"><a class="stretched" href="${href("bewertungen", { sterne: "4,5" })}">Positive Bewertungen</a></h3>${info(
            `Anteil der Rückmeldungen mit 4 oder 5 Sternen. Kritische Bewertungen (1–2 Sterne) sehen Sie in der Verteilung links und in der Bewertungsübersicht.<br>${missingNote(d)}`,
            "Erläuterung zu positiven Bewertungen"
          )}</div>
          <p class="big-value">${d.showable ? fmtPct(d.groups.positive.pct) : "–"}</p>
          <p class="kpi-sub">4–5 ★ · ${fmtInt(d.groups.positive.n)} von ${fmtInt(d.valid)}</p>
          ${deltaHtml(cmp ? cmp.positive : null, "Pp.", st, { reliable: cmp?.reliable })}
        </article>
        <article class="card kpi">
          <div class="card-head"><h3 class="card-title"><a class="stretched" href="${href("bewertungen", { aussage: "SQ001" })}">Anliegen erledigt</a></h3>${info(
            `„${esc(ITEMS.find((i) => i.code === "SQ001").text)}“<br>Anteil „stimme eher zu“ und „stimme voll und ganz zu“ an ${fmtInt(success.valid)} Antworten auf diese Aussage.`,
            "Erläuterung zu Anliegen erledigt"
          )}</div>
          <p class="big-value">${success.showable ? fmtPct(success.groups.positive.pct) : "–"}</p>
          <p class="kpi-sub">Zustimmung · ${fmtInt(success.groups.positive.n)} von ${fmtInt(success.valid)}</p>
          ${deltaHtml(successDelta, "Pp.", st, { reliable: success.reliable && successPrev.reliable })}
        </article>
      </div>

      <article class="card card-trend">
        <div class="card-head"><h3 class="card-title">Verlauf Ø Sterne</h3>${info(
          `Ø Sternebewertung je Monat in den 12 Monaten bis Ende des gewählten Zeitraums. Hinterlegt: gewählter Zeitraum. Zahl unter dem Monat: Anzahl Bewertungen. Leerer Punkt: weniger als ${MIN_N_RELIABLE} Bewertungen.`,
          "Erläuterung zum Verlauf"
        )}</div>
        ${trendChart(st)}
      </article>
    </section>

    <section class="insights" aria-label="Ergebnisse">
      ${insightGood(st, cur, aspects)}
      ${insightImprove(cur, aspects)}
      ${insightAttention(st, cur)}
    </section>`;
}

function insightGood(st, cur, aspects) {
  const best = [...aspects].sort((a, b) => b.d.groups.positive.pct - a.d.groups.positive.pct)[0];
  const services = st.service === "Alle" ? serviceTable(cur, allowedServices(st.office)).filter((s) => s.reliable) : [];
  const top = services.sort((a, b) => b.mean - a.mean)[0];
  const praise = praiseComments(cur);
  const shown = praise.slice(0, 2);
  return `<article class="card insight">
    <div class="card-head"><h3 class="card-title">Das läuft gut</h3>${info(
      `Kommentare: die neuesten Antworten auf „${esc(QUESTION_TEXT.G01Q05)}“ von Personen, die insgesamt 5 Sterne vergeben haben (${fmtInt(praise.length)} im Filter).<br>Top-Service: höchste Ø-Bewertung unter Services mit mindestens ${MIN_N_RELIABLE} Bewertungen.`,
      "Erläuterung zur Auswahl"
    )}</div>
    <dl class="facts">
      ${best ? `<div><dt>Höchste Zustimmung</dt><dd>${esc(best.it.label)} <b>${fmtPct(best.d.groups.positive.pct)}</b></dd></div>` : ""}
      ${top ? `<div><dt>Top-Service</dt><dd>${esc(top.service)} <b>${fmtMean(top.mean)} ★</b></dd></div>` : ""}
    </dl>
    ${shown.length ? `<div class="quotes">${shown.map(quoteCard).join("")}</div>` : `<p class="empty">Keine Kommentare mit 5 Sternen im Filter.</p>`}
    <a class="more-link" href="${href("textfeedback", { sterne: "5" })}">Alle ${fmtInt(praise.length)} Lob-Kommentare mit 5 ★ →</a>
  </article>`;
}

function quoteCard(r) {
  return `<button type="button" class="quote" data-action="detail" data-id="${esc(r.id)}">
    <span class="quote-text">${esc(r.textPositive)}</span>
    <span class="meta">${starsExact(r.stars)} · ${esc(r.service)}</span>
  </button>`;
}

function insightImprove(cur, aspects) {
  const weakest = [...aspects].sort((a, b) => a.d.groups.positive.pct - b.d.groups.positive.pct)[0];
  const t = themeCounts(cur);
  const max = t.list.length ? t.list[0].n : 1;
  return `<article class="card insight">
    <div class="card-head"><h3 class="card-title">Verbesserungspotenzial</h3>${info(
      `Themen aus ${fmtInt(t.totalTexts)} Antworten auf „Was war besonders schlecht?“, zugeordnet per Stichwortliste (siehe Daten &amp; Methodik). Mehrfachzuordnung möglich; ${fmtInt(t.unassigned)} Kommentare ohne Thema. Die Häufigkeit zeigt, worüber geschrieben wird – nicht die Ursache von Bewertungen.`,
      "Erläuterung zu den Themen"
    )}</div>
    <dl class="facts">
      ${weakest ? `<div><dt>Geringste Zustimmung</dt><dd>${esc(weakest.it.label)} <b>${fmtPct(weakest.d.groups.positive.pct)}</b></dd></div>` : ""}
    </dl>
    ${
      t.list.length
        ? `<ol class="theme-list" aria-label="Häufige Themen in der Kritik">${t.list
            .slice(0, 5)
            .map(
              (th) => `<li><a class="theme-row" href="${href("textfeedback", { thema: th.id })}" aria-label="${esc(th.label)}: ${th.n} Kommentare">
                <span class="theme-label">${esc(th.label)}</span>
                <span class="theme-bar"><span style="width:${(th.n / max) * 100}%"></span></span>
                <span class="theme-n">${fmtInt(th.n)}</span>
              </a></li>`
            )
            .join("")}</ol>`
        : `<p class="empty">Keine Kritik-Kommentare im Filter.</p>`
    }
    <a class="more-link" href="${href("textfeedback")}">Alle Kritik-Kommentare →</a>
  </article>`;
}

function insightAttention(st, cur) {
  let body;
  if (st.service !== "Alle") {
    body = `<p class="empty">Ein einzelner Service ist ausgewählt.</p>`;
  } else {
    const rows = serviceTable(cur, allowedServices(st.office));
    const lowest = rows.filter((r) => r.reliable).sort((a, b) => a.mean - b.mean).slice(0, 3);
    body = serviceBars(lowest, { showOffice: st.office === "Alle" });
  }
  return `<article class="card insight">
    <div class="card-head"><h3 class="card-title">Aufmerksamkeit nötig</h3>${info(
      `Die drei Services mit der niedrigsten Ø-Sternebewertung, nur Services mit mindestens ${MIN_N_RELIABLE} Bewertungen. Skala 0–5 Sterne, wie auf der Seite „Services“.`,
      "Erläuterung zur Auswahl"
    )}</div>
    ${body}
    <a class="more-link" href="${href("services")}">Alle Services vergleichen →</a>
  </article>`;
}

function trendChart(st) {
  const recs = applyFilters(DATA.records, { allowedOffices: allowedOffices(), office: st.office, service: st.service });
  const series = monthlySeries(recs, st.period.to);
  const W = 460;
  const H = 210;
  const padL = 22;
  const padR = 6;
  const padT = 18;
  const padB = 36;
  const step = (W - padL - padR) / series.length;
  const x = (i) => padL + (i + 0.5) * step;
  const y = (m) => padT + (1 - (m - 1) / 4) * (H - padT - padB);
  const inSel = (pt) => pt.from >= st.period.from && pt.to <= st.period.to;
  const bands = series.map((pt, i) => (inSel(pt) ? `<rect x="${x(i) - step / 2}" y="${padT - 14}" width="${step}" height="${H - padT - padB + 14}" class="sel-band"/>` : "")).join("");
  const grid = [1, 2, 3, 4, 5]
    .map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${padL - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v}</text>`)
    .join("");
  let path = "";
  series.forEach((pt, i) => {
    if (pt.showable) path += `${path && series[i - 1]?.showable ? "L" : "M"}${x(i).toFixed(1)},${y(pt.mean).toFixed(1)} `;
  });
  const pts = series
    .map((pt, i) =>
      pt.showable
        ? `<circle cx="${x(i)}" cy="${y(pt.mean)}" r="4.5" class="${pt.reliable ? "pt" : "pt pt-low"}"/>
           ${inSel(pt) ? `<text x="${x(i)}" y="${y(pt.mean) - 9}" class="pt-label" text-anchor="middle">${fmtMean(pt.mean)}</text>` : ""}`
        : ""
    )
    .join("");
  const labels = series
    .map((pt, i) => `<text x="${x(i)}" y="${H - padB + 15}" class="axis" text-anchor="middle">${fmtMonth(pt.from)}</text><text x="${x(i)}" y="${H - padB + 28}" class="axis axis-n" text-anchor="middle">${pt.n}</text>`)
    .join("");
  const desc = series.map((p) => `${fmtMonth(p.from)} ${p.from.getFullYear()}: ${p.showable ? fmtMean(p.mean) : "keine Daten"} (N ${p.n})`).join("; ");
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ø Sternebewertung je Monat. ${esc(desc)}">${bands}${grid}<path d="${path}" class="line"/>${pts}${labels}</svg>`;
}

/* ---------------- Ansicht: Bewertungsübersicht ---------------- */

function ratingFilters(params) {
  const item = ITEMS.some((i) => i.code === params.aussage) ? params.aussage : "";
  const wert = /^[1-5]$/.test(params.wert || "") ? params.wert : "";
  return {
    stars: params.sterne ? params.sterne.split(",").filter((s) => /^[1-5]$/.test(s)) : [],
    item: item && wert ? item : "",
    value: item && wert ? Number(wert) : null,
    focusItem: item, // Aussage ohne Wert: nur hervorheben (z. B. Link von der Übersicht)
  };
}

function applyRatingFilters(recs, f, { skipStars = false, skipItem = false } = {}) {
  return recs.filter((r) => {
    if (!skipStars && f.stars.length && !f.stars.includes(String(r.stars))) return false;
    if (!skipItem && f.item && r.items[f.item] !== f.value) return false;
    return true;
  });
}

function ratingChips(f) {
  const chips = [];
  if (f.stars.length)
    chips.push(`<span class="fchip">Sterne: ${f.stars.map((s) => s + " ★").join(", ")} <button type="button" data-action="clear-local" data-keys="sterne" aria-label="Sterne-Filter entfernen">×</button></span>`);
  if (f.item) {
    const it = ITEMS.find((i) => i.code === f.item);
    chips.push(`<span class="fchip">${esc(it.label)}: „${esc(AGREE_SCALE.labels[f.value])}“ <button type="button" data-action="clear-local" data-keys="aussage,wert" aria-label="Filter ${esc(it.label)} entfernen">×</button></span>`);
  }
  return chips;
}

function viewRatings(st) {
  const base = baseFilter(st, st.period);
  const f = ratingFilters(st.params);
  const recs = applyRatingFilters(base, f);
  const dStars = starDist(applyRatingFilters(base, f, { skipStars: true }));
  const chips = ratingChips(f);
  const listParams = { sterne: st.params.sterne, aussage: f.item, wert: f.value };

  return `
    ${pageHead(st, "Bewertungsübersicht", base.length, {
      actions: `<a class="btn" href="${href("einzelbewertungen", listParams)}">Einzelbewertungen anzeigen (${fmtInt(recs.length)}) →</a>`,
    })}
    <div class="filter-line" role="status">
      ${
        chips.length
          ? `<span class="filter-line-label">Gefiltert:</span> ${chips.join("")} <button type="button" class="btn-link" data-action="clear-local" data-keys="sterne,aussage,wert">Zurücksetzen</button> <span class="muted">· ${fmtInt(recs.length)} von ${fmtInt(base.length)} Rückmeldungen</span>`
          : `<span class="muted">Balken oder Säule anklicken, um nach dieser Antwort zu filtern.</span>`
      }
    </div>

    <section class="ratings-grid">
      <article class="card">
        <div class="card-head"><h3 class="card-title">Gesamtzufriedenheit</h3>${info(
          `„${esc(QUESTION_TEXT.G01Q02)}“<br>${missingNote(dStars)}${f.item ? "<br>Berücksichtigt den Filter der Detailbewertung." : ""}`,
          "Erläuterung zur Gesamtzufriedenheit"
        )}</div>
        ${starSummary(dStars)}
        ${starBars(dStars, { clickable: true, selected: f.stars })}
        ${groupLine(dStars)}
      </article>
      ${(() => {
        const dists = ITEMS.map((it) => itemDist(applyRatingFilters(base, f, { skipItem: f.item === it.code }), it.code));
        const sharedMax = Math.max(1, ...dists.flatMap((d) => d.pct.map((p) => p || 0)));
        return ITEMS.map((it, i) => aspectCard(it, dists[i], f, sharedMax)).join("");
      })()}
    </section>`;
}

/* Detailbewertung als fünf Säulen (1 = stimme gar nicht zu … 5 = stimme voll und ganz zu). */
/* sharedMax: gemeinsame Höhenskala für alle Aspekte, damit Säulen vergleichbar sind. */
function aspectCard(it, d, f, sharedMax) {
  const selVal = f.item === it.code ? f.value : null;
  const max = sharedMax;
  const cols = AGREE_SCALE.values
    .map((v, i) => {
      const p = d.pct[i] ?? 0;
      const isSel = selVal === v;
      return `<button type="button" class="acol ${selVal && !isSel ? "dim" : ""}" data-action="toggle-agree" data-item="${it.code}" data-value="${v}" aria-pressed="${isSel}"
          aria-label="${esc(it.label)}: ${esc(AGREE_SCALE.labels[v])} ${d.valid ? p + " Prozent" : "keine Daten"}, ${d.counts[i]} Antworten – filtern">
        <span class="acol-val">${d.valid ? `${p}&nbsp;%` : "–"}</span>
        <span class="acol-bar-wrap"><span class="acol-bar" style="height:${(p / max) * 100}%;background:${SCALE_COLORS[v]}"></span></span>
        <span class="acol-label">${AGREE_SHORT[v]}</span>
      </button>`;
    })
    .join("");
  return `<article class="card aspect ${f.focusItem === it.code ? "is-focus" : ""}">
    <div class="card-head"><h3 class="card-title">${esc(it.label)}</h3>${info(
      `Aussage: „${esc(it.text)}“<br>Säulen: Ich stimme … zu (gar nicht, eher nicht, teils/teils, eher, voll und ganz).<br>Zustimmung = „eher“ + „voll und ganz“. ${missingNote(d, "Antwort auf diese Aussage")}`,
      `Erläuterung zu ${it.label}`
    )}</div>
    <p class="aspect-kpi">${d.showable ? `<b>${fmtPct(d.groups.positive.pct)}</b> Zustimmung` : lowNBadge(d.valid)} <span class="muted">· n = ${fmtInt(d.valid)}</span></p>
    <div class="acols" role="group" aria-label="${esc(it.label)}: Verteilung">${cols}</div>
    <p class="acol-caption" aria-hidden="true">Ich stimme … zu</p>
  </article>`;
}

/* ---------------- Ansicht: Einzelbewertungen ---------------- */

function viewSingle(st) {
  const base = baseFilter(st, st.period);
  const f = ratingFilters(st.params);
  const recs = applyRatingFilters(base, f);
  const chips = ratingChips(f);
  const back = `<a class="back-link" href="${href("bewertungen", { sterne: st.params.sterne, aussage: f.item, wert: f.value })}">← Zurück zur Bewertungsübersicht</a>`;
  return `
    ${pageHead(st, "Einzelbewertungen", base.length, { back })}
    ${chips.length ? `<div class="filter-line" role="status"><span class="filter-line-label">Gefiltert:</span> ${chips.join("")} <button type="button" class="btn-link" data-action="clear-local" data-keys="sterne,aussage,wert">Zurücksetzen</button></div>` : ""}
    ${responsesTable(recs)}`;
}

function responsesTable(recs) {
  const sorted = [...recs].sort((a, b) => b.date - a.date);
  const shown = sorted.slice(0, ui.tablePage * PAGE_SIZE);
  const rows = shown
    .map((r) => {
      const answered = ITEMS.filter((i) => r.items[i.code] != null);
      const agree = answered.filter((i) => r.items[i.code] >= 4).length;
      const texts = [r.textPositive ? "Lob" : "", r.textNegative ? "Kritik" : ""].filter(Boolean);
      return `<tr>
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.service || "–")}<br><small class="muted">${esc(r.office)}</small></td>
        <td>${starsExact(r.stars)}</td>
        <td>${answered.length ? `${agree} von ${answered.length}` : "–"}</td>
        <td>${texts.length ? texts.join(" + ") : `<span class="muted">–</span>`}</td>
        <td><button type="button" class="btn-mini" data-action="detail" data-id="${esc(r.id)}" aria-label="Rückmeldung vom ${fmtDate(r.date)} öffnen">Details</button></td>
      </tr>`;
    })
    .join("");
  return `<article class="card">
    <h3 class="card-title">${fmtInt(recs.length)} Rückmeldungen</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Datum</th><th scope="col">Service</th><th scope="col">Sterne</th><th scope="col">Zustimmung ${info("Anzahl der Aussagen mit „stimme eher zu“ oder „stimme voll und ganz zu“ von allen beantworteten Aussagen.", "Erläuterung zur Spalte Zustimmung")}</th><th scope="col">Kommentar</th><th scope="col"><span class="sr-only">Aktion</span></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="empty">Keine Rückmeldungen für diese Auswahl.</td></tr>`}</tbody>
      </table>
    </div>
    ${shown.length < sorted.length ? `<p class="more"><button type="button" class="btn secondary" data-action="more-rows">Weitere ${PAGE_SIZE} anzeigen (${fmtInt(shown.length)} von ${fmtInt(sorted.length)})</button></p>` : ""}
  </article>`;
}

/* ---------------- Ansicht: Textfeedback ---------------- */

function textFilters(params) {
  return {
    stars: params.sterne ? params.sterne.split(",").filter((s) => /^[1-5]$/.test(s)) : [],
    theme: THEMES.some((t) => t.id === params.thema) || params.thema === "ohne" ? params.thema : "",
  };
}

function viewTexts(st) {
  const base = baseFilter(st, st.period);
  const f = textFilters(st.params);
  const themeLabel = f.theme === "ohne" ? "ohne Thema" : f.theme ? THEMES.find((t) => t.id === f.theme).label : "";
  const active = f.stars.length || f.theme || ui.textSearch.trim();
  return `
    ${pageHead(st, "Textfeedback", base.length)}
    <section class="text-filters" aria-label="Filter für Lob und Kritik">
      <fieldset class="chip-group">
        <legend>Sterne</legend>
        ${[5, 4, 3, 2, 1]
          .map((v) => `<button type="button" class="chip" data-action="toggle-star" data-star="${v}" aria-pressed="${f.stars.includes(String(v))}">${v} ★</button>`)
          .join("")}
      </fieldset>
      <label class="search-label"><span>Suche</span>
        <input type="search" class="search" id="text-search" value="${esc(ui.textSearch)}" placeholder="Stichwort" />
      </label>
      <div class="filter-line text-filter-line" role="status">
        ${f.theme ? `<span class="fchip">Thema: ${esc(themeLabel)} <small>(nur Kritik)</small> <button type="button" data-action="clear-local" data-keys="thema" aria-label="Themenfilter entfernen">×</button></span>` : ""}
        ${active ? `<button type="button" class="btn-link" data-action="reset-text">Filter zurücksetzen</button>` : ""}
      </div>
    </section>
    <div id="text-results">${textColumns(base, f)}</div>`;
}

function textColumns(base, f) {
  const q = ui.textSearch.trim().toLowerCase();
  const common = (r, field) => r[field] && (!f.stars.length || f.stars.includes(String(r.stars))) && (!q || r[field].toLowerCase().includes(q));
  const lob = base.filter((r) => common(r, "textPositive")).sort((a, b) => b.date - a.date);
  let kritik = base.filter((r) => common(r, "textNegative"));
  if (f.theme) {
    kritik = kritik.filter((r) => {
      const ids = matchThemes(r.textNegative);
      return f.theme === "ohne" ? !ids.length : ids.includes(f.theme);
    });
  }
  kritik.sort((a, b) => b.date - a.date);
  return `<div class="text-columns">
    ${textSection("lob", "Lob", "+", lob, "textPositive", QUESTION_TEXT.G01Q05)}
    ${textSection("kritik", "Kritik", "−", kritik, "textNegative", QUESTION_TEXT.G01Q04, "Wird angezeigt, wenn nicht 5 Sterne vergeben wurden (Annahme).")}
  </div>`;
}

function textSection(key, title, symbol, list, field, question, note = "") {
  const shown = list.slice(0, ui.textPages[key] * TEXT_PAGE_SIZE);
  return `<section class="text-section text-${key}" aria-labelledby="ts-${key}">
    <header class="text-section-head">
      <span class="text-symbol" aria-hidden="true">${symbol}</span>
      <h3 id="ts-${key}">${title}</h3>
      <span class="text-count">${fmtInt(list.length)} Kommentare</span>
      ${info(`Frage: „${esc(question)}“${note ? "<br>" + esc(note) : ""}<br>Jeder Kommentar zeigt die Sternebewertung derselben Rückmeldung.`, `Erläuterung zu ${title}`)}
    </header>
    <div class="comment-list">${
      shown
        .map((r) => {
          const tags = field === "textNegative" ? matchThemes(r.textNegative).map((id) => THEMES.find((t) => t.id === id).label) : [];
          return `<button type="button" class="comment" data-action="detail" data-id="${esc(r.id)}">
            <span class="comment-text">${esc(r[field])}</span>
            <span class="meta">${starsExact(r.stars)} · ${esc(r.service)} · ${fmtDate(r.date)}</span>
            ${tags.length ? `<span class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</span>` : ""}
          </button>`;
        })
        .join("") || `<p class="empty">Keine Kommentare für diese Auswahl.</p>`
    }</div>
    ${shown.length < list.length ? `<p class="more"><button type="button" class="btn secondary" data-action="more-text" data-key="${key}">Weitere anzeigen (${fmtInt(shown.length)} von ${fmtInt(list.length)})</button></p>` : ""}
  </section>`;
}

/* ---------------- Ansicht: Services ---------------- */

function viewServices(st) {
  const base = applyFilters(DATA.records, { allowedOffices: allowedOffices(), range: st.period, office: st.office });
  const sort = ["asc", "desc", "n", "name"].includes(st.params.sortierung) ? st.params.sortierung : "asc";
  const offices = st.office !== "Alle" ? [st.office] : allowedOffices();
  const sorter = {
    asc: (a, b) => a.mean - b.mean,
    desc: (a, b) => b.mean - a.mean,
    n: (a, b) => b.n - a.n,
    name: (a, b) => a.service.localeCompare(b.service, "de"),
  }[sort];
  const sections = offices
    .map((office) => {
      const recs = base.filter((r) => r.office === office);
      const od = starDist(recs);
      const rows = serviceTable(recs, CATALOG.find((c) => c.office === office).services);
      const ordered = [...rows.filter((r) => r.reliable).sort(sorter), ...rows.filter((r) => !r.reliable).sort((a, b) => b.n - a.n)];
      return `<section class="office-section" aria-labelledby="office-${esc(office)}">
        <header class="office-head">
          <h3 id="office-${esc(office)}">${esc(office)}</h3>
          <span class="office-sum">${od.showable ? `Ø <b>${fmtMean(od.mean)} ★</b>` : "–"} · N = ${fmtInt(od.valid)} · ${rows.length} Services</span>
        </header>
        <div class="card">${serviceBars(ordered)}</div>
      </section>`;
    })
    .join("");
  const all = starDist(base);
  return `
    ${pageHead({ ...st, service: "Alle" }, "Services", base.length, {
      actions: `<label class="sort-label">Sortierung
        <select data-action="svc-sort">
          <option value="asc" ${sort === "asc" ? "selected" : ""}>Niedrigste Ø zuerst</option>
          <option value="desc" ${sort === "desc" ? "selected" : ""}>Höchste Ø zuerst</option>
          <option value="n" ${sort === "n" ? "selected" : ""}>Meiste Bewertungen</option>
          <option value="name" ${sort === "name" ? "selected" : ""}>Name A–Z</option>
        </select></label>`,
    })}
    <p class="filter-line"><span class="muted">Ø Sternebewertung je Service, Skala 0–5 Sterne · Ø aller Services: <b>${fmtMean(all.mean)} ★</b></span>${info(
      `Balkenlänge = Ø Sterne (1–5) auf einer gemeinsamen Skala von 0 bis 5. N = Anzahl Bewertungen. Services mit weniger als ${MIN_N_RELIABLE} Bewertungen stehen unten, sind schraffiert und markiert. Ein Klick öffnet die Bewertungsübersicht des Services. Es werden Services verglichen, keine Personen.${st.service !== "Alle" ? `<br>Der Service-Filter „${esc(st.service)}“ wird hier nicht angewendet, damit alle Services vergleichbar bleiben.` : ""}`,
      "Erläuterung zum Servicevergleich"
    )}</p>
    ${sections}`;
}

/* ---------------- Ansicht: Daten & Methodik ---------------- */

function viewData(st) {
  const all = DATA.records;
  const incomplete = all.filter((r) => !r.complete).length;
  const unassigned = all.filter((r) => r.complete && r.office === UNASSIGNED_OFFICE).length;
  return `
    ${pageHead(st, "Daten & Methodik", baseFilter(st, st.period).length)}
    <section class="card">
      <h3 class="card-title">Datenquelle</h3>
      <dl class="kv">
        <dt>Quelle</dt><dd>${DATA.source === "sample" ? `<span class="flag">Beispieldaten</span> fiktiv erzeugt, ohne personenbezogene Angaben` : `Import: ${esc(DATA.fileName)} (nur in diesem Browser-Tab, wird nicht gespeichert oder übertragen)`}</dd>
        <dt>Stand</dt><dd>${esc(DATA.lastUpdated)}</dd>
        <dt>Datensätze</dt><dd>${fmtInt(all.length)} gesamt · ${fmtInt(all.length - incomplete)} abgeschlossen · ${fmtInt(incomplete)} nicht abgeschlossen (nicht ausgewertet)</dd>
        <dt>Ohne Dienststelle</dt><dd>${fmtInt(unassigned)} Rückmeldungen mit Service ohne Katalog-Zuordnung</dd>
      </dl>
      <div class="import">
        <label class="btn secondary file-btn">CSV-Export laden<input type="file" accept=".csv,text/csv" id="csv-input" /></label>
        ${DATA.source !== "sample" ? `<button type="button" class="btn-link" data-action="use-sample">Zurück zu Beispieldaten</button>` : ""}
        ${info("Erwartet: Spaltenüberschriften „Feldcode + Fragetext“ (z. B. <code>G02Q03[SQ002]. Die einzelnen …</code>). Antwortwerte 1–5, „A1“–„A5“ oder die Textlabels der Zustimmungsskala werden erkannt.", "Erläuterung zum Import")}
        <div id="import-msg" role="status"></div>
      </div>
    </section>

    <section class="card" id="definitionen">
      <h3 class="card-title">Definitionen</h3>
      <table>
        <thead><tr><th scope="col">Kennzahl</th><th scope="col">Berechnung</th><th scope="col">Bezugsgröße</th></tr></thead>
        <tbody>
          <tr><td>N</td><td>Abgeschlossene Fragebögen (<code>submitdate</code> vorhanden) im Zeitraum und Filter</td><td>–</td></tr>
          <tr><td>Ø Gesamtzufriedenheit</td><td>Mittelwert der Sterne 1–5 aus <code>G01Q02</code></td><td>Rückmeldungen mit Sternebewertung</td></tr>
          <tr><td>Positive Bewertungen</td><td>Anteil 4 oder 5 Sterne</td><td>Rückmeldungen mit Sternebewertung</td></tr>
          <tr><td>Mittlere / Kritische Bewertungen</td><td>Anteil 3 Sterne / 1 oder 2 Sterne</td><td>Rückmeldungen mit Sternebewertung</td></tr>
          <tr><td>Zustimmung</td><td>Anteil „stimme eher zu“ + „stimme voll und ganz zu“ je Aussage <code>G02Q03[…]</code></td><td>Antworten auf diese Aussage</td></tr>
          <tr><td>Ohne Angabe</td><td>Fehlende Antwort auf die jeweilige Frage. Bleibt im Datensatz, wird aber keiner Kategorie zugerechnet und nicht als eigene Kategorie angezeigt.</td><td>nicht im Nenner</td></tr>
          <tr><td>Veränderung</td><td>Differenz zum vorhergehenden Zeitraum gleicher Länge; Anteile in Prozentpunkten (Pp.)</td><td>wie oben, je Zeitraum</td></tr>
          <tr><td>Wenige Antworten</td><td>Hinweis unter ${MIN_N_RELIABLE} Antworten; unter ${MIN_N_SHOW} Antworten keine Werte</td><td>–</td></tr>
        </tbody>
      </table>
      <p class="muted">Prozentwerte werden so gerundet, dass eine Verteilung genau 100 % ergibt und Gruppen (z. B. 4 + 5 Sterne) der Summe der Einzelwerte entsprechen.</p>
    </section>

    <section class="card">
      <h3 class="card-title">Fragen und Kurzbezeichnungen</h3>
      <table><thead><tr><th scope="col">Feldcode</th><th scope="col">Im Dashboard</th><th scope="col">Fragetext</th></tr></thead>
      <tbody>
        <tr><td><code>Q00</code></td><td>Online-Service</td><td>${esc(QUESTION_TEXT.Q00)}</td></tr>
        <tr><td><code>G01Q02</code></td><td>Gesamtzufriedenheit</td><td>${esc(QUESTION_TEXT.G01Q02)}</td></tr>
        ${ITEMS.map((i) => `<tr><td><code>${esc(i.field)}</code></td><td>${esc(i.label)}</td><td>${esc(i.text)}</td></tr>`).join("")}
        <tr><td><code>G01Q04</code></td><td>Textfeedback: Kritik</td><td>${esc(QUESTION_TEXT.G01Q04)}</td></tr>
        <tr><td><code>G01Q05</code></td><td>Textfeedback: Lob</td><td>${esc(QUESTION_TEXT.G01Q05)}</td></tr>
      </tbody></table>
    </section>

    <section class="card">
      <h3 class="card-title">Zuordnung Service → Dienststelle <span class="flag">Beispiel</span></h3>
      <table><thead><tr><th scope="col">Dienststelle</th><th scope="col">Online-Services</th></tr></thead>
      <tbody>${CATALOG.map((c) => `<tr><td>${esc(c.office)}</td><td>${c.services.map(esc).join(", ")}</td></tr>`).join("")}</tbody></table>
    </section>

    <section class="card" id="themen">
      <h3 class="card-title">Themen und Stichwörter</h3>
      <table><thead><tr><th scope="col">Thema</th><th scope="col">Stichwörter (Teilwort, Groß-/Kleinschreibung egal)</th></tr></thead>
      <tbody>${THEMES.map((t) => `<tr><td>${esc(t.label)}</td><td>${t.keywords.map(esc).join(", ")}</td></tr>`).join("")}</tbody></table>
    </section>

    <section class="card">
      <h3 class="card-title">Export</h3>
      <p>Aktuelle Filterung: <b>${fmtInt(baseFilter(st, st.period).length)}</b> Rückmeldungen.</p>
      <button type="button" class="btn" data-action="export-csv">CSV herunterladen</button>
    </section>`;
}

/* ---------------- Detailansicht (Dialog) ---------------- */

function openDetail(id) {
  const r = DATA.records.find((x) => x.id === id);
  if (!r) return;
  const items = ITEMS.map((it) => {
    const v = r.items[it.code];
    return `<tr><th scope="row">${esc(it.label)}<br><small class="muted">${esc(it.text)}</small></th>
      <td>${v == null ? `<span class="muted">keine Angabe</span>` : `<span class="cat-chip" style="background:${SCALE_COLORS[v]};color:${SCALE_TEXT_ON[v]}">${v}</span> ${esc(AGREE_SCALE.labels[v])}`}</td></tr>`;
  }).join("");
  const grp = r.stars == null ? null : Object.values(STAR_SCALE.groups).find((g) => g.values.includes(r.stars));
  const textBox = (txt) => (txt ? `<div class="comment-box">${esc(txt)}</div>` : `<div class="comment-box empty-box">Kein Text (nicht beantwortet oder Frage nicht angezeigt).</div>`);
  openModal(
    `Rückmeldung vom ${fmtDate(r.date)}`,
    `<dl class="kv">
      <dt>Online-Service</dt><dd>${esc(r.service || "–")}</dd>
      <dt>Dienststelle</dt><dd>${esc(r.office)}</dd>
      <dt>Gesamtzufriedenheit</dt><dd>${starsExact(r.stars)} ${r.stars != null ? `${r.stars} von 5 · ${esc(grp.label)}` : ""}</dd>
    </dl>
    <section class="detail-sec"><h3 class="card-title">Lob</h3>${textBox(r.textPositive)}</section>
    <section class="detail-sec"><h3 class="card-title">Kritik</h3>${textBox(r.textNegative)}</section>
    <section class="detail-sec"><h3 class="card-title">Detailbewertungen</h3><table class="detail-items"><tbody>${items}</tbody></table></section>`
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

function closeInfos(except = null) {
  $$(".info-btn[aria-expanded='true']").forEach((b) => {
    if (b === except) return;
    b.setAttribute("aria-expanded", "false");
    document.getElementById(b.getAttribute("aria-controls")).hidden = true;
  });
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 7000);
}

/* ---------------- Globale Filter ---------------- */

function renderFilters(st) {
  const role = currentRole();
  const period = $("#filter-period");
  period.innerHTML = DATA.periods.map((p) => `<option value="${p.id}" ${p.id === st.period.id ? "selected" : ""}>${esc(p.label)}</option>`).join("");
  period.classList.toggle("is-set", st.period.id !== DATA.periods[0].id);

  const offices = allowedOffices();
  const officeSel = $("#filter-office");
  officeSel.innerHTML = (role.offices ? [] : [`<option value="Alle">Alle Dienststellen</option>`]).concat(offices.map((o) => `<option ${o === st.office ? "selected" : ""}>${esc(o)}</option>`)).join("");
  officeSel.disabled = !!role.offices;
  officeSel.title = role.offices ? "Durch die Demo-Rolle festgelegt" : "";
  officeSel.classList.toggle("is-set", st.office !== "Alle" && !role.offices);

  const groups = CATALOG.filter((c) => (st.office === "Alle" ? offices.includes(c.office) : c.office === st.office));
  const svcSel = $("#filter-service");
  svcSel.innerHTML =
    `<option value="Alle">Alle Services</option>` +
    groups.map((g) => `<optgroup label="${esc(g.office)}">${g.services.map((s) => `<option ${s === st.service ? "selected" : ""}>${esc(s)}</option>`).join("")}</optgroup>`).join("");
  svcSel.classList.toggle("is-set", st.service !== "Alle");

  $("#reset-filters").hidden = isDefaultGlobal(st);
  $("#updated-at").textContent = DATA.lastUpdated;
  $("#demo-role").innerHTML = DEMO_ROLES.map((r) => `<option value="${esc(r.id)}" ${r.id === role.id ? "selected" : ""}>${esc(r.label)}</option>`).join("");
}

/* ---------------- Rendern ---------------- */

let lastView = "";
let lastViewKey = "";

function render() {
  const st = getState();
  const viewKey = st.view + JSON.stringify(st.params);
  if (viewKey !== lastViewKey) {
    ui.tablePage = 1;
    ui.textPages = { lob: 1, kritik: 1 };
  }
  if (st.view !== lastView) ui.textSearch = "";
  lastViewKey = viewKey;
  lastView = st.view;
  infoSeq = 0;
  renderFilters(st);
  const navView = st.view === "einzelbewertungen" ? "bewertungen" : st.view;
  $$(".nav-item").forEach((a) => {
    const active = a.dataset.view === navView;
    a.classList.toggle("is-active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
    a.href = href(a.dataset.view);
  });
  $(".brand a").href = href("start");
  $(".mobile-logo-link").href = href("start");
  const views = { start: viewStart, bewertungen: viewRatings, einzelbewertungen: viewSingle, textfeedback: viewTexts, services: viewServices, daten: viewData };
  const root = $("#view-root");
  try {
    root.innerHTML = views[st.view](st);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="card error" role="alert"><h2 class="card-title">Die Ansicht konnte nicht geladen werden.</h2><p>${esc(err.message)}</p><a class="btn" href="#/start">Zur Übersicht</a></div>`;
  }
  document.title = `${VIEWS[st.view]} · Bürgerfeedback Online-Services · Prototyp`;
}

function updateParams(changes) {
  const { view, params } = parseHash();
  location.hash = buildHash(view, { ...params, ...changes });
}

/* ---------------- Ereignisse ---------------- */

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
    window.scrollTo({ top: 0 });
  });

  $("#filter-period").addEventListener("change", (e) => updateParams({ zeitraum: e.target.value }));
  $("#filter-office").addEventListener("change", (e) => {
    const { params } = parseHash();
    const office = e.target.value;
    const changes = { dienststelle: office };
    if (params.service && office !== "Alle" && SERVICE_TO_OFFICE[params.service] !== office) {
      changes.service = "";
      toast(`Service „${params.service}“ zurückgesetzt, weil er nicht zur Dienststelle „${office}“ gehört.`);
    }
    updateParams(changes);
  });
  $("#filter-service").addEventListener("change", (e) => updateParams({ service: e.target.value }));
  $("#reset-filters").addEventListener("click", () => {
    const { view, params } = parseHash();
    const local = Object.fromEntries(Object.entries(params).filter(([k]) => !GLOBAL_KEYS.includes(k)));
    location.hash = buildHash(view, local);
    toast("Zeitraum, Dienststelle und Service zurückgesetzt.");
  });
  $("#demo-role").addEventListener("change", (e) => {
    localStorage.setItem(ROLE_KEY, e.target.value);
    const role = currentRole();
    toast(role.offices ? `Demo-Rolle: nur Daten der Dienststelle „${role.offices[0]}“.` : "Demo-Rolle: zentrale Gesamtansicht.");
    const { view, params } = parseHash();
    const next = { ...params };
    if (!role.offices) delete next.dienststelle;
    location.hash = buildHash(view, next);
    render();
  });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.tagName === "SELECT") {
      if (!e.target.closest(".info-pop")) closeInfos();
      return;
    }
    const a = el.dataset.action;
    const { params } = parseHash();
    if (a === "info") {
      e.preventDefault();
      const open = el.getAttribute("aria-expanded") === "true";
      closeInfos(el);
      el.setAttribute("aria-expanded", String(!open));
      document.getElementById(el.getAttribute("aria-controls")).hidden = open;
      return;
    }
    closeInfos();
    if (a === "detail") openDetail(el.dataset.id);
    else if (a === "toggle-star") {
      const cur = params.sterne ? params.sterne.split(",") : [];
      const s = el.dataset.star;
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      updateParams({ sterne: next.sort().join(",") });
    } else if (a === "toggle-agree") {
      const same = params.aussage === el.dataset.item && params.wert === el.dataset.value;
      updateParams(same ? { aussage: "", wert: "" } : { aussage: el.dataset.item, wert: el.dataset.value });
    } else if (a === "clear-local") {
      updateParams(Object.fromEntries(el.dataset.keys.split(",").map((k) => [k, ""])));
    } else if (a === "reset-text") {
      ui.textSearch = "";
      if (params.sterne || params.thema) updateParams({ sterne: "", thema: "" });
      else render();
    } else if (a === "more-rows") {
      ui.tablePage += 1;
      render();
    } else if (a === "more-text") {
      ui.textPages[el.dataset.key] += 1;
      rerenderTexts();
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
    if (el.dataset.action === "svc-sort") updateParams({ sortierung: el.value });
  });

  document.addEventListener("input", (e) => {
    if (e.target.id !== "text-search") return;
    ui.textSearch = e.target.value;
    ui.textPages = { lob: 1, kritik: 1 };
    rerenderTexts();
  });

  $("#info-btn").addEventListener("click", () =>
    openModal(
      "Hinweise zum Dashboard",
      `<ul class="help-list">
        <li><b>Zweck:</b> Rückmeldungen zu Online-Services auswerten, um Services zu verbessern und Gutes sichtbar zu machen. Es werden Services bewertet, keine Personen.</li>
        <li><b>Filter oben</b> (Zeitraum, Dienststelle, Service) gelten auf allen Seiten.</li>
        <li><b>Bewertungsübersicht:</b> Sterne und Zustimmung zu fünf Aussagen. Ein Klick auf einen Balken oder eine Säule filtert nach dieser Antwort.</li>
        <li><b>Textfeedback:</b> offene Kommentare, getrennt nach Lob und Kritik.</li>
        <li><b>i-Symbole</b> öffnen kurze Erläuterungen. Das Logo führt zur Übersicht.</li>
        <li><b>Demo-Rolle</b> (Seitenleiste) simuliert Zugriffsrechte einer Dienststelle – keine echte Anmeldung.</li>
      </ul>
      <p><a href="#/daten">Definitionen und Methodik</a></p>`
    )
  );
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const openInfo = $(".info-btn[aria-expanded='true']");
      if (openInfo) {
        closeInfos();
        openInfo.focus();
        return;
      }
    }
    if ($("#modal").hidden) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab") {
      const f = $$("#modal button, #modal a[href], #modal select, #modal input").filter((x) => x.offsetParent !== null);
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

/* Nur die Kommentarspalten neu zeichnen (Fokus im Suchfeld bleibt erhalten). */
function rerenderTexts() {
  const st = getState();
  const base = baseFilter(st, st.period);
  const f = textFilters(st.params);
  infoSeq = 1000;
  $("#text-results").innerHTML = textColumns(base, f);
  const active = f.stars.length || f.theme || ui.textSearch.trim();
  const line = $(".text-filter-line");
  if (line && !line.querySelector('[data-action="reset-text"]') && active) line.insertAdjacentHTML("beforeend", `<button type="button" class="btn-link" data-action="reset-text">Filter zurücksetzen</button>`);
  if (line && !active) line.querySelector('[data-action="reset-text"]')?.remove();
}

bind();
render();
