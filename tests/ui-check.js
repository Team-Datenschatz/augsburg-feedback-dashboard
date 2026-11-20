/* UI-Prüfung im Browser (Playwright). Voraussetzung: lokaler Server auf Port 8080.
   Ausführen: python3 -m http.server 8080 &  dann  node tests/ui-check.js [Screenshot-Ordner] */
const { chromium } = require('playwright');
const SP = process.argv[2] || require('os').tmpdir();
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' – ' + info : ''}`);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 2800 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const U = 'http://localhost:8080/';
  const wait = (ms = 150) => p.waitForTimeout(ms);
  await p.goto(U + '#/bewertungen');

  // 1. Dienststelle/Service
  await p.selectOption('#filter-service', 'Fahrzeug zulassen'); await wait();
  check('Service-Filter in URL', p.url().includes('service=Fahrzeug'));
  await p.selectOption('#filter-office', 'Bürgeramt'); await wait(200);
  const svcOpts = await p.$$eval('#filter-service option', o => o.map(x => x.textContent));
  check('Nach Dienststelle nur zugehörige Services', svcOpts.length === 4 && svcOpts.includes('Wohnsitz ummelden') && !svcOpts.includes('Fahrzeug zulassen'), svcOpts.join('|'));
  check('Ungültiger Service zurückgesetzt', !p.url().includes('service='));
  check('Hinweis (Toast) angezeigt', (await p.textContent('#toasts')).includes('zurückgesetzt'));
  await p.goto(U + '#/start?dienststelle=Standesamt&service=Fahrzeug%20zulassen'); await wait(200);
  check('Widersprüchliche URL korrigiert', !p.url().includes('service=') && decodeURIComponent(p.url()).includes('Standesamt'));
  let comboOk = true;
  for (const office of ['Bürgeramt', 'Standesamt', 'Kfz-Zulassungsstelle', 'Ordnungsamt', 'Ausländerbehörde']) {
    await p.goto(U + '#/bewertungen?dienststelle=' + encodeURIComponent(office)); await wait(120);
    const offices = await p.$$eval('tbody tr td:nth-child(2) small', s => [...new Set(s.map(x => x.textContent))]);
    if (offices.length !== 1 || offices[0] !== office) comboOk = false;
  }
  check('Tabelle passt bei jeder Dienststelle', comboOk);

  // 2. Aktive Filter + Zurücksetzen
  await p.goto(U + '#/start?dienststelle=Standesamt'); await wait();
  check('Aktive Filter sichtbar', (await p.textContent('#active-filters')).includes('Dienststelle: Standesamt'));
  await p.click('[data-action="reset-filters"]'); await wait();
  check('Alle Filter zurücksetzen', !p.url().includes('dienststelle'));

  // 3. Kontext bleibt erhalten
  await p.goto(U + '#/start?zeitraum=q&dienststelle=Ordnungsamt'); await wait();
  await p.click('.kpi-row a:nth-child(3)'); await wait();
  const u = decodeURIComponent(p.url());
  check('KPI → Bewertungen mit Sterne-Filter + globalen Filtern', u.includes('bewertungen') && u.includes('sterne=1,2') && u.includes('zeitraum=q') && u.includes('Ordnungsamt'), u);
  const starsInTable = await p.$$eval('tbody .stars-exact', s => s.map(x => x.getAttribute('aria-label')));
  check('Sterne-Filter 1–2 wirkt auf Tabelle', starsInTable.length > 0 && starsInTable.every(l => /^[12] von/.test(l)));
  check('Bereichsfilter als aktiv angezeigt', (await p.textContent('.lf-active')).includes('Sterne: 1 ★, 2 ★'));
  await p.click('.nav-item[data-view="start"]'); await wait();
  const u2 = decodeURIComponent(p.url());
  check('Globale Filter bleiben beim Navigieren erhalten', u2.includes('zeitraum=q') && u2.includes('Ordnungsamt') && !u2.includes('sterne'));
  await p.goBack(); await wait();
  check('Browser-Zurück funktioniert', p.url().includes('bewertungen'));

  // 4. Konsistenz
  await p.goto(U + '#/start'); await wait();
  const kpiPos = await p.textContent('.kpi-row a:nth-child(2) .value');
  const cols = await p.$$eval('.tile[data-tile="verteilung"] .col-val', c => c.slice(0, 5).map(x => parseInt(x.textContent)));
  check('Positiv-KPI = 4★ + 5★ der Verteilung', parseInt(kpiPos) === cols[3] + cols[4], `${kpiPos} vs ${cols}`);
  check('Verteilung summiert sich auf 100 %', cols.reduce((a, c) => a + c, 0) === 100);

  // 5. Logo
  await p.goto(U + '#/services?dienststelle=B%C3%BCrgeramt'); await wait();
  await p.click('.brand a'); await wait();
  check('Logo führt zur Übersicht', p.url().includes('#/start') && (await p.textContent('.view-title')) === 'Übersicht');

  // 6. Detailansicht
  await p.goto(U + '#/textfeedback?art=kritik'); await wait();
  await p.focus('.comment'); await p.keyboard.press('Enter'); await wait();
  const modalTxt = await p.textContent('#modal-body');
  check('Detail zeigt Bewertung und Kommentar', !(await p.isHidden('#modal')) && modalTxt.includes('Gesamtzufriedenheit') && modalTxt.includes('Textfeedback derselben Rückmeldung'));
  check('Fokus im Dialog', await p.evaluate(() => document.activeElement.id === 'modal-close'));
  await p.keyboard.press('Escape'); await wait(100);
  check('Escape schließt, Fokus zurück', (await p.isHidden('#modal')) && await p.evaluate(() => document.activeElement.classList.contains('comment')));

  // 7. Themen + Suche
  await p.click('.chip-group a:nth-of-type(2)'); await wait();
  check('Themenfilter in URL', p.url().includes('thema='));
  check('Gefilterte Kommentare haben Themen-Tag', await p.$$eval('.comment', cs => cs.length > 0 && cs.every(c => c.querySelector('.tag'))));
  await p.fill('#text-search', 'Datei'); await wait(100);
  check('Suche behält Fokus', await p.evaluate(() => document.activeElement.id === 'text-search'));

  // 8. Kacheln
  await p.goto(U + '#/start'); await wait();
  await p.click('[data-action="toggle-customize"]');
  await p.click('[data-action="tile-move"][data-id="potenzial"][data-dir="-1"]');
  await p.selectOption('[data-action="tile-size"][data-id="verlauf"]', 'XL');
  await p.reload(); await wait(200);
  const order = await p.$$eval('.tile', t => t.map(x => x.dataset.tile + ':' + [...x.classList].find(c => c.startsWith('size-'))));
  check('Anordnung gespeichert', order[0] === 'potenzial:size-M' && order.includes('verlauf:size-XL'), order.join(','));
  await p.click('[data-action="toggle-customize"]');
  await p.dragAndDrop('.tile[data-tile="aspekte"] .drag-handle', '.tile[data-tile="potenzial"] .eyebrow'); await wait();
  const order2 = await p.$$eval('.tile', t => t.map(x => x.dataset.tile));
  check('Drag & Drop verschiebt Kachel', order2[0] === 'aspekte', order2.join(','));
  await p.click('[data-action="reset-layout"]'); await wait();
  const order3 = await p.$$eval('.tile', t => t.map(x => x.dataset.tile));
  check('Standardansicht wiederhergestellt', order3.join() === 'gut,potenzial,aufmerksamkeit,verlauf,verteilung,aspekte');

  // 9. Demo-Rolle
  await p.selectOption('#demo-role', 'ds-Standesamt'); await wait(200);
  check('Demo-Rolle sperrt Dienststelle', await p.isDisabled('#filter-office') && (await p.inputValue('#filter-office')) === 'Standesamt');
  await p.goto(U + '#/services'); await wait();
  const blocks = await p.$$eval('.office-block .card-title', t => t.map(x => x.textContent));
  check('Rolle begrenzt Services-Ansicht', blocks.length === 1 && blocks[0] === 'Standesamt');
  await p.selectOption('#demo-role', 'zentral'); await wait();

  // 10. Geringe Fallzahl
  await p.goto(U + '#/services?zeitraum=1m'); await wait();
  check('Geringe Fallzahl markiert', (await p.$$('.flag')).length > 0);

  // 11. Fehlende Bewertung
  await p.goto(U + '#/bewertungen?sterne=fehlend'); await wait();
  const missing = await p.$$eval('tbody td:nth-child(3)', t => t.map(x => x.textContent.trim()));
  check('Fehlende Bewertung als „keine Angabe“', missing.length > 0 && missing.every(m => m === 'keine Angabe'));

  // 12. Tastatur
  await p.goto(U + '#/start'); await wait();
  await p.reload(); await wait(200);
  const seen = new Set();
  for (let i = 0; i < 16; i++) { await p.keyboard.press('Tab'); seen.add(await p.evaluate(() => document.activeElement.id || document.activeElement.className)); }
  check('Tab erreicht Navigation, Rolle, Filter', [...seen].some(s => String(s).includes('nav-item')) && seen.has('filter-period') && seen.has('demo-role'), [...seen].join('|'));

  // Mobil / Tablet
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  m.on('pageerror', e => errs.push(e.message));
  await m.goto(U + '#/start'); await m.waitForTimeout(200);
  check('Mobil ohne horizontales Scrollen', !(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  await m.screenshot({ path: SP + '/mobile.png', fullPage: true });
  const t = await b.newPage({ viewport: { width: 1000, height: 900 } });
  await t.goto(U + '#/start'); await t.waitForTimeout(200);
  check('Tablet ohne horizontales Scrollen', !(await t.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));

  check('Keine JS-Fehler', errs.length === 0, errs.join(' | '));
  console.log(results.join('\n'));
  await b.close();
})();
