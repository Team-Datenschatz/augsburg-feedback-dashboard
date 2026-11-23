/* UI-Prüfung im Browser (Playwright). Voraussetzung: lokaler Server auf Port 8080.
   Ausführen: python3 -m http.server 8080 &  dann  node tests/ui-check.js [Screenshot-Ordner] */
const { chromium } = require('playwright');
const SP = process.argv[2] || require('os').tmpdir();
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info && !ok ? ' – ' + info : ''}`);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const U = 'http://localhost:8080/';
  const wait = (ms = 150) => p.waitForTimeout(ms);
  const go = async (h) => { await p.goto(U + h); await p.reload(); await wait(200); };
  const url = () => decodeURIComponent(p.url());

  // Ticket 1/2/3: Startseite – wichtigste Ergebnisse ohne Scrollen, eine Kachel für positive Bewertungen
  await go('#/start');
  const inFold = async (sel) => p.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
  check('T1: Gesamtzufriedenheit ohne Scrollen sichtbar', await inFold('.card-hero'));
  check('T1: Kennzahlen ohne Scrollen sichtbar', await inFold('.kpi-stack'));
  check('T1: Verlauf ohne Scrollen sichtbar', await inFold('.card-trend'));
  check('T1: Ergebnis-Kacheln ohne Scrollen sichtbar', await inFold('.insights'));
  const titles = await p.$$eval('.card-title', (t) => t.map((x) => x.textContent.trim()));
  check('T2: Kachel „Positive Bewertungen“ vorhanden', titles.includes('Positive Bewertungen'));
  check('T2: Keine separate Kachel „Kritische Bewertungen“', !titles.some((t) => /Kritische/.test(t)), titles.join('|'));
  const bars = await p.$$eval('.card-hero .sb-row', (r) => r.map((x) => x.querySelector('.sb-label').textContent.trim()));
  check('T3: Horizontale Verteilung 5 ★ bis 1 ★', bars.join() === '5 ★,4 ★,3 ★,2 ★,1 ★', bars.join());
  const pcts = await p.$$eval('.card-hero .sb-val b', (v) => v.map((x) => parseInt(x.textContent)));
  const pos = parseInt(await p.textContent('.kpi-primary .big-value'));
  check('T3/T7: Verteilung ergibt 100 %, Positiv = 5 ★ + 4 ★', pcts.reduce((a, c) => a + c, 0) === 100 && pos === pcts[0] + pcts[1], `${pcts} / ${pos}`);
  check('T3: Anzahl Bewertungen kompakt angegeben', /\d[\d.]* Bewertungen/.test(await p.textContent('.card-hero .star-summary')));
  check('T7: Keine Kategorie „ohne Angabe“ in der Verteilung', !(await p.innerText('.card-hero .star-bars')).includes('ohne Angabe'));
  await go('#/start?dienststelle=Standesamt');
  const nStand = await p.textContent('.card-hero .star-summary .muted');
  await go('#/start');
  const nAll = await p.textContent('.card-hero .star-summary .muted');
  check('T3: Verteilung berücksichtigt aktive Filter', nStand !== nAll);

  // Ticket 4: keine Layoutanpassung
  check('T4: Keine Bedienelemente zur Layoutanpassung', (await p.$$('[data-action^="tile"], [data-action="toggle-customize"], [draggable="true"]')).length === 0);

  // Ticket 5: kurze Überschriften, Info-Element per Klick und Tastatur
  const eyebrows = await p.$$('.eyebrow');
  check('T5: Keine doppelten Überschriften („Was läuft gut?“)', eyebrows.length === 0 && !(await p.textContent('#view-root')).includes('Was läuft gut?'));
  const infoBtn = await p.$('.card-hero .info-btn');
  await infoBtn.click(); await wait(80);
  const popId = await infoBtn.getAttribute('aria-controls');
  check('T5: Info-Element öffnet per Klick', await p.isVisible('#' + popId));
  await p.keyboard.press('Escape'); await wait(80);
  check('T5: Info-Element schließt per Escape, Fokus bleibt', (await p.isHidden('#' + popId)) && (await p.evaluate(() => document.activeElement.classList.contains('info-btn'))));
  await infoBtn.focus(); await p.keyboard.press('Enter'); await wait(80);
  check('T5: Info-Element per Tastatur (Enter) bedienbar', await p.isVisible('#' + popId));
  await p.keyboard.press('Escape');
  check('T5: Zeitraum und N kompakt sichtbar', /N = [\d.]+/.test(await p.textContent('.context')));

  // Ticket 6: Bezeichnung
  const navLabel = (await p.textContent('.nav-item[data-view="bewertungen"] span')).replace(/\u00AD/g, '').trim();
  await go('#/bewertungen');
  const heading = (await p.textContent('.page-title')).trim();
  check('T6: Navigation und Überschrift „Bewertungsübersicht“', navLabel === 'Bewertungsübersicht' && heading === 'Bewertungsübersicht', `${navLabel} / ${heading}`);

  // Ticket 8: Detailbewertungen als 5 Säulen
  const aspectCols = await p.$$eval('.aspect', (a) => a.map((x) => x.querySelectorAll('.acol').length));
  check('T8: 5 Aspekte mit je 5 Säulen', aspectCols.length === 5 && aspectCols.every((n) => n === 5), aspectCols.join());
  const labels = await p.$$eval('.aspect:nth-child(2) .acol-label', (l) => l.map((x) => x.textContent.trim()));
  check('T8: Säulen beschriftet', labels.length === 5 && labels.every(Boolean), labels.join('|'));
  check('T8: Keine kumulierten Seitenbalken mehr', (await p.$$('.stack')).length === 0);
  check('T7: Keine Kategorie „ohne Angabe“ in der Bewertungsübersicht', !(await p.innerText('.ratings-grid')).includes('ohne Angabe'));
  const aspectPct = await p.$$eval('.aspect', (a) => a.map((x) => [...x.querySelectorAll('.acol-val')].reduce((s, v) => s + parseInt(v.textContent), 0)));
  check('T8: Säulen je Aspekt summieren sich auf 100 %', aspectPct.every((s) => s === 100), aspectPct.join());

  // Ticket 9: Einzelbewertungen getrennt
  check('T9: Keine lange Liste in der Bewertungsübersicht', (await p.$$('#view-root table')).length === 0);

  // Ticket 10: Diagrammauswahl filtert
  await p.click('.sb-row[data-star="5"]'); await wait();
  check('T10: Klick auf 5 ★-Balken filtert', url().includes('sterne=5') && (await p.getAttribute('.sb-row[data-star="5"]', 'aria-pressed')) === 'true');
  await p.click('.aspect:nth-child(2) .acol[data-value="5"]'); await wait();
  check('T10: Klick auf Säule filtert nach Antwort', url().includes('aussage=SQ002') && url().includes('wert=5'));
  check('T10: Aktive Filter als Chips sichtbar', (await p.$$('.filter-line .fchip')).length === 2);
  const btnText = await p.textContent('.page-actions .btn');
  await p.click('.page-actions .btn'); await wait();
  check('T9: Zugang führt zu Einzelbewertungen mit Filtern', url().includes('#/einzelbewertungen') && url().includes('sterne=5') && url().includes('wert=5'), url());
  const rowStars = await p.$$eval('tbody .stars-exact', (s) => s.map((x) => x.getAttribute('aria-label')));
  check('T9: Liste entspricht den Filtern', rowStars.length > 0 && rowStars.every((l) => l.startsWith('5 von')));
  check('T9: Anzahl im Zugang stimmt mit Liste überein', btnText.includes(`(${(await p.textContent('.card .card-title')).split(' ')[0]})`), btnText);
  await p.click('.back-link'); await wait();
  check('T9: Rückweg behält Filter', url().includes('#/bewertungen') && url().includes('sterne=5') && url().includes('wert=5'));
  await p.click('.filter-line .btn-link'); await wait();
  check('T10: Bereichsfilter zurücksetzen', !/[?&](sterne|aussage|wert)=/.test(url()), url());
  await p.focus('.sb-row[data-star="2"]'); await p.keyboard.press('Space'); await wait();
  check('T10: Diagrammauswahl per Tastatur', url().includes('sterne=2'));

  // Globale Filter
  await go('#/bewertungen?dienststelle=Standesamt');
  check('Globale Filter: Zurücksetzen sichtbar und wirksam', await p.isVisible('#reset-filters'));
  await p.click('#reset-filters'); await wait();
  check('Globale Filter: zurückgesetzt', !url().includes('dienststelle') && (await p.isHidden('#reset-filters')));
  await p.selectOption('#filter-service', 'Fahrzeug zulassen'); await wait();
  await p.selectOption('#filter-office', 'Bürgeramt'); await wait(200);
  check('Dienststelle ↔ Service: ungültige Auswahl zurückgesetzt', !url().includes('service='));
  await go('#/start?dienststelle=Standesamt&service=Fahrzeug%20zulassen');
  check('Dienststelle ↔ Service: widersprüchliche URL korrigiert', !url().includes('service='));

  // Ticket 11/12: Textfeedback
  await go('#/textfeedback');
  const heads = await p.$$eval('.text-section-head h3', (h) => h.map((x) => x.textContent.trim()));
  check('T11: Bereiche „Lob“ und „Kritik“ beschriftet', heads.join() === 'Lob,Kritik', heads.join());
  check('T11: Unterscheidung auch ohne Farbe (Symbol + Text)', (await p.$$eval('.text-symbol', (s) => s.map((x) => x.textContent.trim()))).join() === '+,−');
  check('T5: Kein Erklärungsabsatz unter „Textfeedback“', (await p.$$('.view-desc, .page-head p:not(.context)')).length === 0);
  check('T12: Eine gemeinsame Filterleiste', (await p.$$('.text-filters')).length === 1 && (await p.$$('.text-section .chip, .text-section input')).length === 0);
  await p.click('.text-filters .chip[data-star="3"]'); await wait();
  const lobStars = await p.$$eval('.text-lob .comment .stars-exact', (s) => s.map((x) => x.getAttribute('aria-label')));
  const kritikStars = await p.$$eval('.text-kritik .comment .stars-exact', (s) => s.map((x) => x.getAttribute('aria-label')));
  check('T12: Sterne-Filter wirkt gleich auf Lob und Kritik', lobStars.length > 0 && kritikStars.length > 0 && [...lobStars, ...kritikStars].every((l) => l.startsWith('3 von')));
  await p.fill('#text-search', 'Upload'); await wait(100);
  check('T12: Suche behält Fokus', await p.evaluate(() => document.activeElement.id === 'text-search'));
  check('T12: Zurücksetzen sichtbar', await p.isVisible('[data-action="reset-text"]'));
  await p.click('[data-action="reset-text"]'); await wait();
  check('T12: Filter zurückgesetzt', !url().includes('sterne') && (await p.inputValue('#text-search')) === '');
  check('T5: Kommentar zeigt zugehörige Sterne', (await p.$$('.comment .stars-exact')).length > 0);
  await p.focus('.text-kritik .comment'); await p.keyboard.press('Enter'); await wait();
  const modal = await p.textContent('#modal-body');
  check('Detailansicht: Bewertung und Kommentar gemeinsam', modal.includes('Gesamtzufriedenheit') && modal.includes('Kritik') && modal.includes('Detailbewertungen'));
  await p.keyboard.press('Escape'); await wait();
  check('Detailansicht: Escape, Fokus zurück', (await p.isHidden('#modal')) && (await p.evaluate(() => document.activeElement.classList.contains('comment'))));
  await go('#/textfeedback?thema=upload');
  check('Themenfilter von der Startseite als Chip', (await p.textContent('.text-filters')).includes('Thema: Hochladen von Nachweisen'));

  // Ticket 13/14: Services
  await go('#/services');
  const officeH = await p.$$eval('.office-head h3', (h) => h.map((x) => parseFloat(getComputedStyle(x).fontSize)));
  check('T13: Dienststellen als hervorgehobene Abschnitte', officeH.length === 5 && officeH.every((s) => s >= 20));
  check('T14: Kein Punkt-/Liniendiagramm mehr', (await p.$$('.dot, .dot-track, .ref-line')).length === 0);
  const svcOk = await p.$$eval('.svc-bar', (rows) => rows.every((r) => r.querySelector('.svc-bar-val b').textContent.includes('★') && r.querySelector('.svc-bar-val small').textContent.startsWith('N =')));
  check('T14: Balken mit Wert, Einheit und N beschriftet', svcOk);
  const widths = await p.$$eval('.svc-bar', (rows) => rows.map((r) => {
    const fill = r.querySelector('.svc-bar-fill'); const track = r.querySelector('.svc-bar-track');
    return { w: fill ? fill.getBoundingClientRect().width / track.getBoundingClientRect().width : 0, v: parseFloat(r.querySelector('.svc-bar-val b').textContent.replace(',', '.')) };
  }));
  check('T14: Gemeinsame Skala 0–5 (Länge = Wert/5)', widths.every((x) => Math.abs(x.w - x.v / 5) < 0.02));
  await p.click('.svc-bar'); await wait();
  check('Service-Balken öffnet Bewertungsübersicht des Services', url().includes('#/bewertungen') && url().includes('service='));

  // Logo, Demo-Rolle, Tastatur, Responsiv
  await go('#/services');
  await p.click('.brand a'); await wait();
  check('Logo führt zur Übersicht', url().includes('#/start'));
  await p.selectOption('#demo-role', 'ds-Standesamt'); await wait(200);
  check('Demo-Rolle sperrt Dienststelle', (await p.isDisabled('#filter-office')) && (await p.inputValue('#filter-office')) === 'Standesamt');
  await p.selectOption('#demo-role', 'zentral'); await wait();
  await go('#/start');
  const seen = new Set();
  for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); seen.add(await p.evaluate(() => document.activeElement.id || document.activeElement.className)); }
  check('Tab erreicht Navigation, Rolle und Filter', [...seen].some((s) => String(s).includes('nav-item')) && seen.has('filter-period') && seen.has('demo-role'), [...seen].join('|'));

  for (const [w, h, name] of [[390, 844, 'Smartphone'], [1000, 900, 'Tablet']]) {
    const m = await b.newPage({ viewport: { width: w, height: h } });
    m.on('pageerror', (e) => errs.push(e.message));
    let ok = true;
    for (const v of ['start', 'bewertungen', 'textfeedback', 'services']) {
      await m.goto(U + '#/' + v); await m.waitForTimeout(150);
      if (await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) ok = false;
    }
    check(`${name}: kein horizontales Scrollen`, ok);
    await m.goto(U + '#/start'); await m.waitForTimeout(150);
    await m.screenshot({ path: `${SP}/${name}.png`, fullPage: true });
  }

  check('Keine JS-Fehler', errs.length === 0, errs.join(' | '));
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} bestanden`);
  await b.close();
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})();
