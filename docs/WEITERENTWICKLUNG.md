# Weiterentwicklung: Bürgerfeedback-Dashboard

## Runde 2: Vereinfachung (Stand 23.11.2026)

Die Vorgaben zur Vereinfachung haben Vorrang vor den früheren Anforderungen nach Anpassungs- und Interaktionsmöglichkeiten. An den Berechnungen (`js/metrics.js`) hat sich nichts geändert.

| Ticket | Umsetzung |
| --- | --- |
| 1 Startseite priorisieren | Feste Reihenfolge: zuerst Kennzahlen und Diagramme (Gesamtzufriedenheit mit Verteilung, positive Bewertungen, „Anliegen erledigt“, Verlauf), darunter drei Ergebniskacheln. Bei 1440×900 ist alles ohne Scrollen sichtbar. Die separate Filterchip-Zeile, der Untertitel, die Kacheln „Verteilung“ und „Bewertete Aspekte“ (jetzt Teil der Gesamtzufriedenheit bzw. der Bewertungsübersicht) sowie die Wertetabellen sind entfallen. |
| 2 Kritische Kachel entfernt | Nur noch die hervorgehobene Kachel „Positive Bewertungen“. Kritische Bewertungen stehen vollständig in der Verteilung direkt daneben (1–2 ★) und in der Bewertungsübersicht („Kritisch (1–2 ★)“). |
| 3 Kompakte Sterneverteilung | Durchschnitt mit Sternen, Anzahl der Bewertungen, waagerechte Balken von 5 ★ bis 1 ★ mit Prozent und Anzahl, nach dem Vorbild von Google/Amazon. Die Verteilung berücksichtigt alle aktiven Filter. |
| 4 Layoutanpassung entfernt | Verschieben, Größenänderung, gespeicherte Anordnung und die zugehörigen Schaltflächen sind entfernt. Das Layout passt sich weiterhin an die Bildschirmgröße an (Desktop 3 Spalten, Tablet 2, Smartphone 1). |
| 5 Texte gekürzt | Kurze Überschriften ohne Dopplungen (z. B. nur noch „Das läuft gut“). Der Einleitungsabsatz unter „Textfeedback“ ist entfernt. Längere Erklärungen stecken in einem einheitlichen **i**-Info-Element (öffnen per Klick oder Enter, schließen per Escape oder Klick daneben). Zeitraum, Bereich und N stehen kompakt unter jeder Seitenüberschrift; jeder Kommentar zeigt seine Sternebewertung. |
| 6 Neue Bezeichnung | „Bewertungsübersicht“ in Navigation, Seitenüberschrift und Fenstertitel. Davon klar abgegrenzt: „Textfeedback“. |
| 7 „Keine Angabe“ ausgeblendet | Keine eigene Kategorie mehr in Verteilungen und Filtern. Fehlende Antworten bleiben im Datensatz, zählen zu keiner Kategorie und nicht zum Nenner. Die Bezugsgröße steht sichtbar („1.272 Bewertungen“, „n = 1.268“); die Anzahl ohne Angabe nennt das Info-Element. |
| 8 Detailbewertungen als Säulen | Jede Aussage hat eine eigene Karte mit kurzer Überschrift, Zustimmungswert, n und fünf beschrifteten Säulen („gar nicht“ … „voll und ganz“, Achse „Ich stimme … zu“). Alle Karten nutzen eine gemeinsame Höhenskala. Der Fragetext steht im Info-Element. Berechnungen sind unverändert. |
| 9 Einzelbewertungen getrennt | Eigene Seite „Einzelbewertungen“, erreichbar über die Schaltfläche „Einzelbewertungen anzeigen (n)“. Filter werden übernommen; „← Zurück zur Bewertungsübersicht“ behält sie bei. |
| 10 Bedienung vereinfacht | Die Auswahllisten und Sterne-Chips der Bewertungsübersicht sind entfallen. Stattdessen filtert ein Klick (oder Enter/Leertaste) auf einen Sterne-Balken oder eine Säule direkt. Aktive Filter erscheinen als Chips mit × und „Zurücksetzen“. Globale Filter sind hervorgehoben, wenn sie gesetzt sind, und lassen sich mit „Filter zurücksetzen“ im Kopf zurücksetzen. |
| 11 Lob und Kritik getrennt | Zwei nebeneinanderliegende Bereiche (auf schmalen Bildschirmen untereinander) mit großer Überschrift „Lob“ bzw. „Kritik“, Symbol (+ / −), Anzahl und eigener Kopfzeile. Auch ohne Farbe unterscheidbar: Symbol, Text und durchgezogener bzw. gestrichelter Rand. |
| 12 Einheitliche Filter | Eine gemeinsame Filterleiste (Sterne, Suche) gilt für beide Bereiche gleichzeitig, mit einem gemeinsamen „Filter zurücksetzen“. Der Themenfilter aus „Verbesserungspotenzial“ gilt fachlich nur für Kritik und ist im Chip so gekennzeichnet. |
| 13 Dienststellen gegliedert | Je Dienststelle ein Abschnitt mit großer grüner Überschrift, Unterstrich, Kennzahlen (Ø, N, Anzahl Services) und Abstand zum nächsten Abschnitt. Die Zuordnung ist unverändert. |
| 14 Diagramm ersetzt | Waagerechte Balken: Länge = Ø Sterne auf einer gemeinsamen Skala von 0 bis 5 (Achse beschriftet), Wert „4,2 ★“ und „N = …“ an jedem Balken. Bei wenigen Antworten ist der Balken schraffiert und markiert. Dieselbe Darstellung nutzt die Kachel „Aufmerksamkeit nötig“. Ein Klick öffnet die Bewertungsübersicht des Services. |

**Entscheidungen, die bestätigt werden sollten**
- Name „Bewertungsübersicht“ (Ticket 6, Vorschlag aus dem Ticket übernommen).
- Lob und Kritik nebeneinander statt Umschalter. Damit gelten die Filter automatisch für beide (Ticket 12).
- Balken statt Säulen auf der Services-Seite, weil Servicenamen lang sind. Die Skala beginnt bei 0, damit Balkenlängen proportional zum Wert sind.
- Eine Aussagenauswahl filtert nach genau einer Antwortstufe (eindeutige Zuordnung). Gruppenfilter wie „alle Zustimmenden“ gibt es nicht mehr; der Positiv-Link der Startseite filtert auf 4 und 5 Sterne.
- Die Demo-Rolle ist auf Smartphones weiterhin ausgeblendet.

**Prüfungen Runde 2**: Unit-Tests 13/13. Browser-Prüfung (`tests/ui-check.js`) 60/60, mit Kriterien je Ticket, u. a.:
- Ergebnisse ohne Scrollen sichtbar bei 1440×900
- keine Kachel „Kritische Bewertungen“
- Verteilung = 100 %, und Positiv = 5 ★ + 4 ★
- keine Layout-Bedienelemente
- Info-Element per Klick und Tastatur
- 5 Säulen je Aspekt, die sich jeweils auf 100 % summieren
- Filter per Diagrammklick und Tastatur
- Einzelbewertungen mit Filterübernahme und Rückweg
- gemeinsame Text-Filter
- Servicebalken proportional zur Skala 0–5
- kein horizontales Scrollen auf Smartphone und Tablet
- keine JS-Fehler

**Für den nächsten Nutzertest**
- Reicht die Startseite ohne Scrollen für den Überblick?
- Werden die i-Elemente gefunden?
- Ist die Filterung per Klick auf Balken und Säulen ohne Erklärung verständlich?
- Wird „Bewertungsübersicht“ verstanden?
- Sind Lob und Kritik nebeneinander gut lesbar?

---

## Runde 1 (Stand 20.11.2026)

Grundlage: bestehender Clickdummy, neuer Fragebogen (Q00, G01Q02, G02Q03[SQ001–SQ005], G01Q04, G01Q05), Erkenntnisse aus Sarikaya et al. (2019) und Rückmeldungen aus dem ersten Nutzertest. Teile dieser Runde (Kachelanpassung, kumulierte Balken, Bereichsfilter-Auswahllisten, Punktdiagramm) wurden in Runde 2 bewusst ersetzt.

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
