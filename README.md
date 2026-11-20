# Bürgerfeedback-Dashboard Online-Services (Prototyp)

Interaktiver Prototyp eines Dashboards für die Stadt Augsburg. Er wertet den Feedbackfragebogen aus, der nach der Nutzung eines Online-Services angezeigt wird. Ohne eigene Datei arbeitet er mit **fiktiven Beispieldaten**; das Logo dient nur der Demonstration.

Das Dashboard beantwortet auf der Startseite drei Fragen: **Was läuft gut? Wo gibt es Verbesserungspotenzial? Welche Services benötigen Aufmerksamkeit?** Es vergleicht Services, keine Personen.

## Aufbau

| Bereich | Inhalt |
| --- | --- |
| Übersicht | 4 Kennzahlen mit Vergleichszeitraum, Kacheln „Das läuft gut“, „Verbesserungspotenziale“, „Services mit Aufmerksamkeitsbedarf“, Zeitverlauf, Sterneverteilung, bewertete Aspekte. Kacheln lassen sich verschieben und in der Größe ändern. |
| Bewertungen | Strukturierte Antworten (Sterne, Zustimmungsskalen) mit Bereichsfilter nach Sternen und Antwortkategorie, Einzelbewertungen |
| Textfeedback | Offene Kommentare (Kritik/Lob), Themenbündelung per Stichwortliste, Suche |
| Services | Servicevergleich je Dienststelle (Ø Sterne + Fallzahl auf einheitlicher Skala) |
| Daten & Methodik | Datenquelle, Definitionen, Zuordnungen, CSV-Import und -Export |

Technik: statisches HTML/CSS/JavaScript ohne Build-Schritt.

- `js/config.js`: Fragebogen-Schema, Skalen, Service-Katalog, Themen, Zeiträume
- `js/data.js`: Beispieldaten im Exportformat, Normalisierung, CSV-Import
- `js/metrics.js`: Berechnungen
- `js/app.js`: Oberfläche

## Lokal starten

```bash
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Prüfungen

```bash
node --test tests/*.test.js
```

Browser-Prüfung (benötigt Playwright und einen laufenden lokalen Server):

```bash
node tests/ui-check.js
```

## Weiterentwicklung

Umgesetzte Verbesserungen, Annahmen, offene fachliche Fragen und Hinweise für den nächsten Nutzertest: [docs/WEITERENTWICKLUNG.md](docs/WEITERENTWICKLUNG.md).

## GitHub Pages

Veröffentlichung aus dem `main`-Branch (Ordner `/`); vor dem Deployment laufen die Unit-Tests.
