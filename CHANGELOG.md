# Änderungen

Alle nennenswerten Änderungen an SkyLog DE, neueste zuerst. Der Abschnitt einer Version erscheint
beim Release automatisch als Text auf der GitHub-Release-Seite (siehe `.github/workflows/release.yml`).

## [1.3.0]

### Neu
- **Sicherheitskopie vor dem Ersetzen:** Beim Einspielen einer Sicherung zeigt die App, was in der
  Datei steckt (Flüge, Drohnen, Zeitraum), und sichert vorher automatisch deine aktuellen Daten als
  Datei. Ein Fehlgriff kostet damit nichts.
- **Karte im Dunkelmodus:** Die Online-Karte wird dunkel umgefärbt, Offline-Karten nutzen einen echten
  dunklen Kartenstil. Geozonen behalten ihre Warnfarben.
- **Datenschutzerklärung auf Englisch;** die deutsche Fassung duzt jetzt wie die App.
- **Mehr Platz auf großen Bildschirmen:** Flugplaner, SORA-Assistent, Statistik und Import sind am
  Laptop zweispaltig, Listen auf Tablets mehrspaltig.

### Verbessert
- **SORA 2.5:** Der Boden-Risikowert (iGRC) kommt jetzt aus der offiziellen Tabelle (Abmessung,
  Geschwindigkeit, Bevölkerungsdichte), Minderungen zählen je Robustheit; SAIL-Matrix und OSO-Liste
  korrigiert.
- **Regel-Check:** Bestandsdrohnen ab 250 g fliegen seit 2024 nur noch in A3.
- **CSV-Export** öffnet sich sauber in Excel: Semikolon als Trenner, Ortsnamen mit Komma und
  mehrzeilige Notizen bleiben in ihrer Spalte, Temperatur und Wind als eigene Zahlenspalten.
- **Schnellerer Start:** weniger Code beim ersten Laden; das Logbuch lädt sein Wochen-Diagramm ohne
  große Diagramm-Bibliothek (138 → 36 kB beim ersten Öffnen).
- **Offline-Karten im Browser** werden in Teilstücken geladen und klappen damit auch über den
  Web-Server.
- **Vorflug-Checkliste:** nur noch eine anpassbare Liste, die den Start freigibt.
- **Standort** wird erst nach einer kurzen Erklärung abgefragt; die installierte Web-App fordert
  dauerhaften Speicher an.
- **Texte:** alle Dialoge vollständig zweisprachig, Groß- und Kleinschreibung korrigiert.

### Behoben
- Eine beschädigte Sicherung konnte beim Ersetzen alle Daten löschen – jetzt wird sie vorher geprüft,
  und bei einem Fehler bleibt alles, wie es war.
- Flüge, Wartungen und Dateinamen zwischen 0 und 2 Uhr bekamen das Datum vom Vortag.
- Die Namensnennung „© OpenStreetMap“ fehlte im Flugplaner und war auf der Hauptkarte teilweise
  verdeckt.

### Barrierefreiheit
- Dialoge führen den Tastatur-Fokus (hinein, drin halten, zurück), Rückfragen haben einen Namen.
- Kontrast nach WCAG AA (4,5 : 1), alle Felder beschriftet, Scrollbereiche per Tastatur erreichbar.
- Größere Tippflächen auf der Karte; die Tasten der PIN-Sperre sind für Screenreader beschriftet.

### Datenschutz und Sicherheit
- Datenschutzerklärung um Rechtsgrundlagen, Drittländer, Speicherdauer und deine Rechte ergänzt.
- Sicherheits-Header und Content-Security-Policy für die Web-Version, Herkunftsprüfung am KI-Endpunkt.
- Die App meldet sich bei den OpenStreetMap-Diensten mit eigener Kennung.

### Technik
- Deutlich mehr Tests: 786 Unit- und 78 Oberflächentests, alle grün.
- Große Dateien aufgeteilt, Großschrift und Fettdruck vereinheitlicht.

## [1.2.0] – 2026-10-20

- Software-Check 1 umgesetzt (alle 30 Befunde) und die dringenden Befunde aus Check 2: Standort und
  Zurück-Taste in der Android-App, GPS nur bei Bedarf, Zoomen erlaubt, aktuelle Datenschutzerklärung.
- Einheitliches, helles Design mit gemeinsamen Bausteinen; Flotte, Dialoge und Formulare umgestellt.
- Laptop-Layout mit Seitenleiste, zweispaltiges Logbuch.
- Demo-Modus mit Beispieldaten und geführte Ersteinrichtung; Fristen als Kalenderdatei (.ics).
- Englisch für die Fach-Dialoge (SORA, Staffelmatrix, Kunden, Vorflug-Check u. a.).

## [1.1.0] – 2026-10-20

- Signierte Release-APK per Versions-Tag; Android-Benachrichtigungen für Fristen.
- PIN-Sperre mit PBKDF2, Datensicherung mit Verschlüsselung, Ersatzteil-Inventar.
- Flächenplanung mit beliebigen Vielecken; Erststart rund 40 % kleiner.
- Englische Oberfläche für die Hauptansichten; 50 Oberflächentests.
- Aktuelle Werkzeuge: TypeScript 6 (strict), Vite 8, Vitest 5, ESLint 10.
