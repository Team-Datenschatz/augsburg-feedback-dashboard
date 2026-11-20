# Weiterentwicklung: Bürgerfeedback-Dashboard (Stand 20.11.2026)

Grundlage: bestehender Clickdummy, neuer Fragebogen (Q00, G01Q02, G02Q03[SQ001–SQ005], G01Q04, G01Q05), Erkenntnisse aus Sarikaya et al. (2019) und Rückmeldungen aus dem ersten Nutzertest.

## 1. Bestandsaufnahme: Was war vorhanden, was wurde geändert?

| Anforderung | Vorher | Jetzt |
| --- | --- | --- |
| Datenmodell zum neuen Fragebogen | 6 alte Aussagen, kein Bezug zu Feldcodes | Schema nach Feldcodes. Die Aussagen werden über den Code zugeordnet, nicht über die Spaltenposition (Exportreihenfolge SQ002…SQ005, SQ001). CSV-Import für echte Exporte. |
| Startseite mit 3–5 Kennzahlen | 4 KPIs, u. a. „Anzahl Bewertungen“ ohne Aussagekraft | 4 KPIs: Ø Sterne (anteilig gefüllte Sterne wie bei Google), Positive Bewertungen, Kritische Bewertungen, „Anliegen erfolgreich erledigt“. Jede KPI zeigt den Vergleich zum Vorzeitraum. Die Fallzahl steht in der Randnotiz. |
| Zeitraum, Bereich, N | nur im Filter | Kontextzeile auf jeder Seite: Zeitraum, Bereich, N, Hinweis „nicht repräsentativ“ |
| Fehlende Daten / geringe Fallzahl | nicht berücksichtigt; Sterne mindestens 1 erzwungen | „keine Angabe“ getrennt ausgewiesen und nie als 0 Sterne gezählt; Hinweis unter 30, keine Werte unter 5 Antworten |
| Top-2/Bottom-2 | Fachbegriffe; Detailansicht prüfte noch auf die alte Note 6/7 (immer leer) | „Positive / Mittlere / Kritische Bewertungen“ (Sterne) bzw. „Zustimmung / Teils-teils / Ablehnung“ (Zustimmungsskala), jeweils mit Kategorien, Nenner und vollständiger Verteilung |
| Zustimmungsskala | Balkenlänge = Ø/5 bei Achse von 1–5: Wert 1 lag bei 20 % statt 0 %, die Beschriftung war gegenüber dem Balken verschoben. Die Sterneverteilung war mit Zustimmungslabels beschriftet. | 100-%-Balken pro Aussage, einheitlich links Ablehnung → rechts Zustimmung, mit Legende aller fünf Stufen. Sterne haben eigene Beschriftungen. Punktdiagramme nutzen eine echte 1–5-Achse. |
| Konstrukte als Überschrift | nur Fragetexte | Kurzbezeichnung als Überschrift (aus dem Fragetext abgeleitet), Fragetext per „Fragetext anzeigen“ |
| Bewertungen vs. Textfeedback | gemischt | eigene Bereiche mit Erklärung. Die Detailansicht zeigt Bewertung und beide Kommentare derselben Rückmeldung. |
| Filter im Bereich Bewertungen | keine | Sterne (inkl. „ohne Angabe“) und Aussage + Antwortkategorie. Ausdrücklich als lokaler Filter gekennzeichnet; Dienststelle, Service und Zeitraum sind globale Filter. |
| Dienststelle ↔ Service | unabhängig zufällig (z. B. „Standesamt – Führerschein“) | Katalog mit eindeutiger Zuordnung. Die Service-Auswahl wird auf die Dienststelle begrenzt. Ungültige Kombinationen (auch per URL) werden mit Hinweis zurückgesetzt. |
| Aktive Filter, Zurücksetzen | nicht vorhanden | Filterchips mit „×“ und „Alle Filter zurücksetzen“ |
| Rollen | nicht vorhanden | Demo-Rollenauswahl (gelb, „DEMO“), getrennt von Ansichtsfiltern; sie sperrt die Dienststelle |
| „Das läuft gut“ | 4 beliebige positive Zitate | oben auf der Startseite: höchste Zustimmung, best bewertete Services (N ≥ 30) und die 3 neuesten Kommentare von Personen mit 5 Sternen. Die Auswahlregel steht dabei. |
| Servicevergleich | nicht vorhanden | Seite „Services“: Ø Sterne + N je Dienststelle, einheitliche Skala, Sortierung wählbar; geringe Fallzahlen unten und markiert |
| Verbesserungspotenziale | nicht vorhanden | Themen aus G01Q04 per offengelegter Stichwortliste mit Häufigkeit und Link zu den Kommentaren; Aspekt mit geringster Zustimmung |
| Navigation / Details | Modals ohne Rückweg, Filterverlust | Zustand in der URL: Filter bleiben beim Wechsel erhalten, Browser-Zurück funktioniert, „← Zurück zu …“-Link; Logo führt zur Übersicht |
| Kacheln anpassen | nicht vorhanden | „Ansicht anpassen“: Drag-and-drop oder Schaltflächen „Nach vorne/hinten“, Größe per Auswahlfeld; im Browser gespeichert; „Standardansicht wiederherstellen“ |
| Barrierearmut | Klickflächen teils ohne Tastaturbedienung | Links und Buttons statt klickbarer `div`s, sichtbarer Fokus, Skip-Link, Fokusführung im Dialog, Werte-Tabellen zu Diagrammen, Farben immer mit Text |

Beibehalten: Farbwelt (Augsburg-Grün), Logo, Skyline, Schrift, Kartenstil, Seitenleiste mit mobiler Tab-Leiste, Beispieldaten-Banner.

## 2. Dokumentierte Korrekturen an Berechnungsregeln

1. **Ø-Bewertung**: Vorher wurde der Mittelwert der 6 Aussagen als „Durchschnittliche Bewertung“ gezeigt, die Top-/Bottom-Anteile aber aus der Gesamtnote berechnet. Jetzt beruhen Ø, Positiv- und Kritisch-Anteil einheitlich auf der Gesamtzufriedenheit G01Q02.
2. **Nenner**: Jede Kennzahl bezieht sich auf die gültigen Antworten der jeweiligen Frage. Fehlende Werte erscheinen getrennt.
3. **Grundgesamtheit**: Nur abgeschlossene Fragebögen (`submitdate` gefüllt) werden ausgewertet.
4. **Rundung**: Verfahren der größten Reste, sodass Verteilungen 100 % ergeben und Gruppen der Summe der Einzelwerte entsprechen. Vorher konnten Donut und Legende voneinander abweichen.
5. **Vergleichszeitraum**: unmittelbar vorhergehender Zeitraum gleicher Länge; Anteile als Differenz in Prozentpunkten.

## 3. Annahmen (fachlich zu bestätigen)

- G01Q02 ist eine 5-stufige Sternebewertung, 1 = schlechteste, 5 = beste.
- G02Q03 ist 5-stufig: „stimme überhaupt nicht zu“ … „stimme voll und ganz zu“. Leer gilt als „keine Angabe“.
- G01Q04 wird nur bei weniger als 5 Sternen angezeigt; G01Q05 allen und freiwillig.
- Die Gruppierung Positiv = 4+5, Mittel = 3, Kritisch = 1+2 gilt für beide Skalen.
- Mindestfallzahlen: Hinweis unter 30, keine Werte unter 5.
- Die Zuordnung Service → Dienststelle und die Service-Namen sind **Beispiele**.
- Die Kurzbezeichnungen der Aussagen sind aus dem Fragetext abgeleitet (keine neuen Konstrukte).
- Die Themen-Stichwortliste ist ein erster Vorschlag. Nur Kommentare mit Treffer werden zugeordnet; es gibt keine KI und keine Zusammenfassungen.
- Die Demo-Rolle simuliert Berechtigungen nur im Browser; echte Zugriffsrechte müssen serverseitig umgesetzt werden.

## 4. Offene fachliche Fragen

1. Wie lauten die tatsächlichen Antwortcodes und Skalenrichtungen im Export (Zahlen, A1–A5, Textlabels)?
2. Unter welcher Bedingung wird G01Q04 bzw. G01Q05 angezeigt? Davon hängt ab, wie leere Felder zu deuten sind.
3. Welche verbindliche Liste der Online-Services mit Zuordnung zur Dienststelle gibt es? Können Services mehreren Stellen zugeordnet sein?
4. Gibt es offizielle Konstruktbezeichnungen (z. B. „Verständlichkeit“) für die fünf Aussagen?
5. Welche Mindestfallzahl ist fachlich und datenschutzrechtlich gewünscht (auch für Freitexte kleiner Services)?
6. Sollen Freitexte vor der Anzeige auf personenbezogene Angaben geprüft oder geschwärzt werden?
7. Wer pflegt die Themen-Stichwortliste?
8. Welche Rollen und Berechtigungen gibt es tatsächlich (zentral, Dienststelle, Service-Verantwortliche)?
9. Sollen auch nicht abgeschlossene Fragebögen (Abbruchquote) ausgewertet werden?

## 5. Ergebnis der Prüfungen

- **Unit-Tests** (`node --test tests/*.test.js`): 13/13 bestanden. Geprüft werden Rundung auf 100 %, Gruppen = Summe der Einzelwerte, fehlende Werte nicht im Nenner und nicht als 0 Sterne, Zuordnung der Aussagen über den Feldcode, eindeutige Service-Dienststelle-Zuordnung, Lob-Auswahl nur bei 5 Sternen, Themenzuordnung, Vergleichszeiträume und CSV-Import (u. a. „A2“, Textlabels, Anführungszeichen, unbekannte Services).
- **Browser-Prüfung** (`tests/ui-check.js`, Chromium): 33/33 bestanden.
  - Dienststelle und Service passen bei jeder Dienststelle zusammen; ungültige Auswahl wird mit Hinweis zurückgesetzt, auch bei manipulierter URL.
  - Der Sterne-Filter wirkt auf die Tabelle; „ohne Angabe“ wird nie als 0 Sterne gezeigt.
  - Der Positiv-Anteil der KPI ist gleich 4★ + 5★ der Verteilung; die Verteilung ergibt 100 %.
  - Filter bleiben beim Wechsel Übersicht ↔ Details erhalten; Browser-Zurück funktioniert.
  - Das Logo führt zur Übersicht.
  - Die Detailansicht zeigt Bewertung und Kommentar zusammen; Fokus und Escape funktionieren.
  - Kacheln: Verschieben per Schaltfläche und per Drag-and-drop, Speichern und Wiederherstellen funktionieren.
  - Die Demo-Rolle begrenzt die Daten.
  - Navigation und Filter sind per Tab erreichbar, Sterne-Säulen per Leertaste bedienbar.
  - Kein horizontales Scrollen auf Smartphone (390 px) und Tablet (1000 px); keine JavaScript-Fehler.
- Nicht geprüft: Screenreader-Ausgabe mit echten Hilfsmitteln, Windows-Hochkontrastmodus, echte Exportdatei (liegt nicht vor).

## 6. Für den nächsten Nutzertest

1. Sind „Positive/Kritische Bewertungen“ und „Zustimmung/Ablehnung“ ohne Erklärung verständlich? Wird klar, dass „Mittel“ und „ohne Angabe“ fehlen bzw. separat stehen?
2. Wird die Zustimmungsskala (100-%-Balken, links Ablehnung, rechts Zustimmung) jetzt richtig gelesen?
3. Beantwortet die Startseite die drei Leitfragen in unter einer Minute?
4. Wird der Unterschied zwischen globalen Filtern und Bereichsfilter verstanden? Wird der Hinweis beim automatischen Zurücksetzen eines Services bemerkt?
5. Sind die Themen unter „Verbesserungspotenziale“ nachvollziehbar und nützlich? Fehlen Themen?
6. Wird die Auswahlregel bei „Das läuft gut“ wahrgenommen und als fair empfunden?
7. Werden Kacheln angepasst? Ist die Schaltflächen-Alternative auffindbar?
8. Wirkt der Servicevergleich als Unterstützung oder als Kontrolle (Überwachungsgefühl)?
9. Ist die Demo-Rolle eindeutig als Simulation erkennbar?
10. Mobile Nutzung: Ist die Demo-Rolle auf dem Smartphone überhaupt nötig? Sie ist dort derzeit ausgeblendet.
