/* =====================================================================
   Fachliche Konfiguration: Fragebogen-Schema, Skalen, Service-Katalog,
   Zeiträume, Themen für Verbesserungspotenziale.
   Alles, was fachlich bestätigt werden muss, ist mit ANNAHME markiert.
   ===================================================================== */

/* ---------- Fragebogen-Felder (Feldcodes aus dem LimeSurvey-Export) ---------- */
const FIELD = {
  id: "id",
  submitdate: "submitdate",
  lastpage: "lastpage",
  startlanguage: "startlanguage",
  seed: "seed",
  startdate: "startdate",
  datestamp: "datestamp",
  service: "Q00",
  stars: "G01Q02",
  textNegative: "G01Q04",
  textPositive: "G01Q05",
};

const QUESTION_TEXT = {
  Q00: "Welchen Online-Service haben Sie genutzt?",
  G01Q02: "Wie zufrieden sind Sie insgesamt mit diesem Online-Service?",
  G02Q03:
    "Abschließend würde uns Ihre Einschätzung im Detail interessieren. Wie sehr stimmen Sie den folgenden fünf Aussagen zu?",
  G01Q04:
    "Es tut uns leid, dass Sie mit dem Online-Service nicht vollständig zufrieden waren. Was war aus Ihrer Sicht besonders schlecht?",
  G01Q05: "Was hat Ihnen am Online-Service besonders gut gefallen?",
};

/* Zustimmungsaussagen G02Q03[SQxxx] – Reihenfolge wie im Export (SQ002 … SQ005, SQ001).
   `label` ist eine Kurzbezeichnung, die direkt aus dem Fragetext abgeleitet ist
   (kein neues Konstrukt). ANNAHME: fachliche Bestätigung der Kurzbezeichnungen steht aus. */
const ITEMS = [
  { code: "SQ002", field: "G02Q03[SQ002]", label: "Nachvollziehbare Schritte",
    text: "Die einzelnen Schritte beim Ausfüllen des Online-Services waren für mich nachvollziehbar." },
  { code: "SQ003", field: "G02Q03[SQ003]", label: "Klarheit der erforderlichen Angaben",
    text: "Ich wusste jederzeit, welche Angaben und Nachweise erforderlich sind." },
  { code: "SQ004", field: "G02Q03[SQ004]", label: "Verständliche Hinweise",
    text: "Die Erläuterungen und Hinweise waren verständlich formuliert." },
  { code: "SQ005", field: "G02Q03[SQ005]", label: "Zuverlässigkeit",
    text: "Der Online-Service funktionierte während meiner Nutzung zuverlässig." },
  { code: "SQ001", field: "G02Q03[SQ001]", label: "Anliegen erfolgreich erledigt",
    text: "Ich konnte mein Anliegen mit diesem Online-Service erfolgreich erledigen." },
];

/* ---------- Skalen ----------
   ANNAHME: G01Q02 ist eine 5-stufige Sternebewertung (1 = schlechteste, 5 = beste).
   ANNAHME: G02Q03 ist eine 5-stufige Zustimmungsskala (1 = stimme überhaupt nicht zu,
   5 = stimme voll und ganz zu); „keine Angabe“ wird als fehlend behandelt.
   Darstellung immer von links (negativ) nach rechts (positiv). */
const STAR_SCALE = {
  values: [1, 2, 3, 4, 5],
  labels: { 1: "1 Stern", 2: "2 Sterne", 3: "3 Sterne", 4: "4 Sterne", 5: "5 Sterne" },
  groups: {
    critical: { label: "Kritische Bewertungen", short: "Kritisch", values: [1, 2], desc: "1 oder 2 Sterne" },
    neutral: { label: "Mittlere Bewertungen", short: "Mittel", values: [3], desc: "3 Sterne" },
    positive: { label: "Positive Bewertungen", short: "Positiv", values: [4, 5], desc: "4 oder 5 Sterne" },
  },
};

const AGREE_SCALE = {
  values: [1, 2, 3, 4, 5],
  labels: {
    1: "Stimme überhaupt nicht zu",
    2: "Stimme eher nicht zu",
    3: "Teils/teils",
    4: "Stimme eher zu",
    5: "Stimme voll und ganz zu",
  },
  groups: {
    critical: { label: "Ablehnung", short: "Ablehnung", values: [1, 2], desc: "„stimme überhaupt nicht zu“ oder „stimme eher nicht zu“" },
    neutral: { label: "Teils/teils", short: "Teils/teils", values: [3], desc: "„teils/teils“" },
    positive: { label: "Zustimmung", short: "Zustimmung", values: [4, 5], desc: "„stimme eher zu“ oder „stimme voll und ganz zu“" },
  },
};

/* Farben je Skalenstufe 1…5 (rot = kritisch, grau = mittel, grün = positiv) –
   identisch für Sterne und Zustimmung, damit die Richtung überall gleich ist. */
const SCALE_COLORS = { 1: "#a8231d", 2: "#e47466", 3: "#b8bdb9", 4: "#5fa673", 5: "#165a32" };
const SCALE_TEXT_ON = { 1: "#fff", 2: "#3b0d09", 3: "#1c2a22", 4: "#0d2b18", 5: "#fff" };

/* ---------- Mindestfallzahlen ----------
   ANNAHME: Unter 30 Antworten gilt eine Fallzahl als gering (Hinweis);
   unter 5 werden keine Mittelwerte/Anteile gezeigt. */
const MIN_N_RELIABLE = 30;
const MIN_N_SHOW = 5;

/* ---------- Dienststellen und Online-Services ----------
   Q00 liefert nur den Service. Die Dienststelle wird über diesen Katalog eindeutig
   zugeordnet (ein Service gehört genau zu einer Dienststelle).
   BEISPIELDATEN: Zuordnung ist fiktiv und muss fachlich ersetzt werden. */
const CATALOG = [
  { office: "Bürgeramt", services: ["Meldebescheinigung beantragen", "Wohnsitz ummelden", "Führungszeugnis beantragen"] },
  { office: "Standesamt", services: ["Geburtsurkunde bestellen", "Eheurkunde bestellen", "Sterbeurkunde bestellen"] },
  { office: "Kfz-Zulassungsstelle", services: ["Fahrzeug zulassen", "Fahrzeug außer Betrieb setzen", "Wunschkennzeichen reservieren"] },
  { office: "Ordnungsamt", services: ["Bewohnerparkausweis beantragen", "Gewerbe anmelden"] },
  { office: "Ausländerbehörde", services: ["Aufenthaltstitel verlängern", "Verpflichtungserklärung abgeben"] },
];
const OFFICES = CATALOG.map((c) => c.office);
const SERVICE_TO_OFFICE = Object.fromEntries(CATALOG.flatMap((c) => c.services.map((s) => [s, c.office])));
const ALL_SERVICES = CATALOG.flatMap((c) => c.services);
const UNASSIGNED_OFFICE = "Nicht zugeordnet";

/* ---------- Themen für Verbesserungspotenziale ----------
   Regelbasierte Bündelung der offenen Antworten aus G01Q04 per Stichwort.
   Ein Kommentar kann mehreren Themen zugeordnet sein; Kommentare ohne Treffer
   erscheinen unter „Nicht zugeordnet“. Keine KI, keine erfundenen Zusammenfassungen. */
const THEMES = [
  { id: "technik", label: "Technische Fehler und Abbrüche",
    keywords: ["fehler", "abgestürzt", "absturz", "hängt", "hing", "abgebrochen", "abbruch", "geflogen", "lädt nicht", "ladezeit", "server"] },
  { id: "upload", label: "Hochladen von Nachweisen",
    keywords: ["upload", "hochladen", "hochgeladen", "datei", "dokument", "pdf", "foto"] },
  { id: "verstaendlich", label: "Verständlichkeit von Texten und Begriffen",
    keywords: ["unverständlich", "verstanden", "begriff", "fachbegriff", "behördendeutsch", "unklar", "erklärung", "verwirrend"] },
  { id: "angaben", label: "Unklare Anforderungen und Pflichtangaben",
    keywords: ["pflichtfeld", "nachweis", "welche unterlagen", "nicht klar, welche", "angaben", "vorher wissen"] },
  { id: "login", label: "Anmeldung und Konto (z. B. BundID)",
    keywords: ["login", "anmeldung", "anmelden", "bundid", "konto", "passwort", "ausweisfunktion", "eid"] },
  { id: "mobil", label: "Nutzung auf Smartphone/Tablet",
    keywords: ["handy", "smartphone", "tablet", "mobil", "bildschirm", "zu klein"] },
  { id: "dauer", label: "Dauer und Rückmeldung nach dem Absenden",
    keywords: ["dauer", "dauert", "lange", "wartezeit", "keine rückmeldung", "bestätigung", "status"] },
  { id: "bezahlung", label: "Bezahlung",
    keywords: ["bezahl", "zahlung", "gebühr", "paypal", "kreditkarte", "giropay"] },
];

/* ---------- Zeiträume ----------
   Vollständige Kalendermonate; Vergleich jeweils mit dem unmittelbar vorhergehenden
   Zeitraum gleicher Länge. Datenbestand der Beispieldaten: 11/2024 – 10/2026. */
const DATA_START = new Date(2024, 10, 1);
const DATA_END = new Date(2026, 9, 31, 23, 59, 59);
const SAMPLE_LAST_UPDATED = "01.11.2026, 06:00 Uhr";

function monthRange(y, m, months) {
  const from = new Date(y, m, 1);
  const to = new Date(y, m + months, 0, 23, 59, 59);
  return { from, to };
}
function shiftMonths(range, months) {
  const f = range.from;
  return monthRange(f.getFullYear(), f.getMonth() + months, monthsBetween(range));
}
function monthsBetween(range) {
  return (range.to.getFullYear() - range.from.getFullYear()) * 12 + range.to.getMonth() - range.from.getMonth() + 1;
}

/* Baut die Zeitraumauswahl relativ zum letzten vollständigen Monat im Datenbestand. */
function buildPeriods(lastDate) {
  const y = lastDate.getFullYear();
  const m = lastDate.getMonth();
  const qEndMonth = m - ((m + 1) % 3); // letztes abgeschlossenes Quartal
  const qStart = qEndMonth - 2;
  const qDate = new Date(y, qStart, 1);
  const defs = [
    { id: "3m", name: "Letzte 3 Monate", ...monthRange(y, m - 2, 3) },
    { id: "1m", name: "Letzter Monat", ...monthRange(y, m, 1) },
    { id: "q", name: `${Math.floor(qDate.getMonth() / 3) + 1}. Quartal ${qDate.getFullYear()}`, ...monthRange(y, qStart, 3) },
    { id: "12m", name: "Letzte 12 Monate", ...monthRange(y, m - 11, 12) },
  ];
  return defs.map((p) => {
    const prev = shiftMonths(p, -monthsBetween(p));
    return { ...p, label: `${p.name} (${rangeLabel(p)})`, rangeText: rangeLabel(p), prev, prevLabel: rangeLabel(prev) };
  });
}

function rangeLabel(r) {
  const o = { month: "short", year: "numeric" };
  const a = r.from.toLocaleDateString("de-DE", o);
  const b = r.to.toLocaleDateString("de-DE", o);
  return a === b ? a : `${a} – ${b}`;
}

/* ---------- Demo-Rollen (simulieren Berechtigungen, keine echte Anmeldung) ---------- */
const DEMO_ROLES = [
  { id: "zentral", label: "Zentrale Gesamtansicht (alle Dienststellen)", offices: null },
  ...OFFICES.map((o) => ({ id: `ds-${o}`, label: `Dienststelle: ${o}`, offices: [o] })),
];
