# SkyLog DE – Weiterarbeit-Briefing

**Für einen neuen Chat: diese Datei zuerst lesen.** Der alte
`../SkyLog-Sicherung/WIEDERAUFBAU-Fahrplan.md` ist erledigt und nur noch Historie.
Zuletzt aktualisiert: 2026-10-24 (Projekt aus OneDrive verschoben, Abhängigkeiten geprüft;
Release v1.3.0 weiterhin vorbereitet, noch nicht getaggt).

## Worum es geht
Drohnen-Flugbuch-App („die Handy-App für die Drohne"). Ursprüngliches Ziel war, die
funktionsreichste Handy-Version (APK vom 22.05.2026, Quelltext verloren) nachzubauen.
Das ist erreicht und inzwischen deutlich übertroffen. Weitergearbeitet wird **hier** in
`skylog-de-verbessert`.

- **Repo:** GitHub `Luk1236/skylog-de` · Hauptbranch `master` · Releases per Tag `v*.*.*`
- **APK vom 22.05.2026 gesichert:** `../SkyLog-Sicherung/skylog-handy-2026-05-22.apk`
- `../skylog-handy` ist der alte Prototyp (Repo `Luk1236/Flug`) – überholt.

## Nachtrag 2026-10-24
- Das Projekt liegt jetzt unter **`C:\Users\lukas\Projekte\SkyLog`** (nicht mehr in OneDrive).
  Der alte OneDrive-Ordner ist entfernt und liegt im OneDrive-Papierkorb. Damit sind die
  `UNKNOWN: read`-Fehler und die extrem langsamen Builds/ESLint-Läufe weg.
- `node_modules` auf diesem PC (x64) neu installiert; `npm audit fix` hat drei Hinweise
  (1 hoch, 1 mittel, 1 niedrig) behoben – jetzt **0 Schwachstellen**.
- Am neuen Ort verifiziert: `npm run check` sauber (TypeScript + ESLint), `npm run build:app`
  erfolgreich. Der Build lief zuvor in OneDrive nach über 10 Minuten in einen Fehler, jetzt in
  unter einer Sekunde.
- Der Worktree `../skylog-n14` ist wieder verknüpft (Pfade angepasst); die Tests sind inzwischen
  übernommen, der Worktree wird nicht mehr gebraucht.
- **Echte IndexedDB-Tests aus `n14` übernommen** (`db.test.ts`, `db.transaktion.test.ts`,
  Dev-Abhängigkeit `fake-indexeddb`). Dabei den Bugfix mitgenommen: `saveFlight` läuft jetzt in
  einer Transaktion und zählt den Akku-Zyklus nicht erneut, wenn ein bestehender Flug nur um
  Fotos oder die Flugspur ergänzt wird. 841 Tests in 77 Dateien, alle grün.
- **N16 entschieden:** Die App-Daten sind von der Google-Kontosicherung ausgenommen
  (`dataExtractionRules` für Android 12+, `fullBackupContent` für ältere Versionen); der lokale
  Gerätewechsel bleibt erlaubt. Datenschutzerklärung DE/EN angepasst, Wächter in
  `src/konfiguration.test.ts`.
- **DJI-SRT-Import mit echten Dateien geprüft** (Mavic Air 2, Mavic Pro, Phantom 4, Matrice 300,
  Mavic Mini): Der Parser liest jetzt auch „longtitude“, Datumsangaben mit Punkten und
  einstelligen Monaten, Millisekunden im Zeitstempel sowie `altitude`/`Hb`/`Hs`. Fehlt in der
  Datei ein Datum, übernimmt der Import das Datum der Datei und weist im Hinweis darauf hin.
  19 Tests in `djiSrt.test.ts`.
- **Oberfläche und CSP lokal verifiziert:** 79 Playwright-Tests grün (20 s); die
  Produktionsauslieferung über `npm start` mit CSP lief ohne Konsolen- oder CSP-Fehler.
  Der Vercel-spezifische Gegencheck bleibt offen, bis dort deployt ist.
- **Datenschutz-Verantwortlicher eingetragen:** Lukas Bootz, Offenburg, Deutschland,
  Lukas.bootz@gmx.de; Hosting: Vercel Inc., USA (beim Deploy bestätigen). Keine gelben
  Platzhalter mehr; die juristische Prüfung bleibt offen.
- **Weitere Verbesserungen (24.10.):** Server-Bundle liegt in `dist-server/` und wird nicht mehr
  öffentlich ausgeliefert; `npm start` liefert auch ohne `NODE_ENV` die Produktionsfassung inkl.
  CSP, Vite wird nur im Dev-Modus geladen. PIN sperrt nach einer Minute im Hintergrund.
  Importmeldungen sind zweisprachig, SRT-Spuren werden auf höchstens 2.000 Punkte ausgedünnt,
  Flüge unter einer Minute als 1 Minute gespeichert. CSP-Bilder nur von Karten-/WMS-Hosts.
  E2E-Test für den gemeinsamen CSV-/SRT-Import; Lizenz ergänzt, `metadata.json` entfernt.
- **Signatur und Passwort getrennt:** Der Schlüssel liegt unter
  `SkyLog-Sicherung\android-signatur`, das Passwort unter
  `C:\Users\lukas\Projekte\SkyLog-Zugangsdaten`. Beide `LIESMICH.md` verweisen aufeinander.
- **Karten-/Cache-Fix:** Service-Worker-Updates übernehmen sofort und laden einmal neu; HTML und
  `sw.js` werden mit `no-cache` ausgeliefert, Assets bleiben lang im Cache. Ungültige Koordinaten
  ([0,0] aus einem Import ohne Position) werden ignoriert: kein Null-Island-Marker, die Karte
  bleibt beim Standardort. 841 Tests in 77 Dateien.

## Stand 2026-10-21
Verifiziert: `tsc` (strict) sauber · ESLint 0 Warnungen · **841 Unit-Tests** (77 Dateien, davon
echte IndexedDB-Tests für Migration, Transaktionen und Zurückrollen sowie Komponententests für
Assistent, Logbuch, Flotte, Wartung, Sicherheit, Standort-Hinweis, Checklisten-Editor,
Dialog-Fokus, Einspielen, SORA und Kunden) · **79 Playwright-Tests** inkl.
Kontrast-Wächter (WCAG AA 4,5 : 1), Handy-Abläufen, Ebenen/Zurück, Tastatur-Fokus und Karten-Namensnennung. Abdeckung: Fachlogik 81 %, Ansichten 48 %, gesamt
51 %. axe: 0 Verstöße in 22 Ansichten. Erststart ~170 kB gzip, Logbuch beim ersten Öffnen +36 kB.
Release v1.2.0 ist veröffentlicht; Runde 8 bis 15 sind in master. **Release v1.3.0 ist vorbereitet**
(Branch `release/v1.3.0`: Version 1.3.0, `CHANGELOG.md`, Release-Text aus dem Changelog) – getaggt wird erst
nach dem APK-Test auf dem Handy: `git tag v1.3.0 && git push origin v1.3.0`. Vorher möglichst die Lücken in
der Datenschutzerklärung füllen (R3-02); der Release-Lauf warnt, solange Platzhalter drinstehen.

Software-Check 3 (Dashboard, 21.10.) fand 13 neue Befunde R3-01 … R3-13. Runde 11 (Branch
`check4/dringende-befunde`) behebt die drei dringenden:
- **R3-01 Datenverlust beim Einspielen:** `importAllData` bricht die Transaktion jetzt ausdrücklich
  ab, wenn `put()` sofort wirft – vorher blieb beim Ersetzen die geleerte Datenbank stehen.
  Zusätzlich prüft `importBackup` die Sicherung vorab (jeder Eintrag braucht eine ID, jede Liste
  muss eine Liste sein) und meldet „Es wurde nichts verändert“ auf Deutsch und Englisch.
  Test mit nachgebauter Transaktion (`db.import.test.ts`, schlägt ohne den Fix fehl). Die echten
  IndexedDB-Tests mit fake-indexeddb sind am 2026-10-24 aus `check2/n14-testabdeckung` übernommen
  (`db.test.ts`, `db.transaktion.test.ts`).
- **R3-03 Fokus in Dialogen:** `src/lib/useDialogFokus.ts` (Fokus beim Öffnen in die Ebene, Tab
  bleibt drin, beim Schließen zurück auf den Auslöser). Gilt für den gemeinsamen `Dialog` (26
  Dialoge), die Rückfragen (jetzt mit zugänglichem Namen, Fokus auf „Abbrechen“), Behörden-Check,
  Flug-Assistent (jetzt `role="dialog"`) und die Foto-Großansicht (jetzt mit Schließen-Knopf).
  Tests: `src/components/dialogFokus.test.tsx`, `e2e/fokus.spec.ts`.
- **R3-02 Datenschutzerklärung:** Rechtsgrundlagen, Drittländer, Speicherdauer, Rechte samt
  Beschwerderecht, OpenStreetMap France als Kachel-Quelle der Hauptkarte; die falsche Aussage
  „keine personenbezogenen Daten auf externe Server“ ist richtiggestellt. Wächter in
  `src/konfiguration.test.ts`. **Eingetragen am 2026-10-24:** Lukas Bootz, Offenburg, Deutschland,
  Lukas.bootz@gmx.de; Hosting: Vercel Inc., USA. Offen bleibt die juristische Prüfung (u. a.
  Grundlage für das Vereinigte Königreich/OSM Foundation). Eine vollständige Postanschrift
  (Straße, PLZ) ist für eine belastbare Datenschutzerklärung empfehlenswert.

Runde 12 (Branch `check4/mittlere-befunde`), die mittleren Befunde R3-04 bis R3-09:
- **R3-04 Datum:** `lokalesDatum()` in `src/lib/utils.ts` (Ortszeit statt UTC) an allen 11 Stellen,
  auch Wartung, Exporte und Wochen-Diagramm; Test mit 00:30 Uhr Sommerzeit. Ersetzt den alten
  Branch `check2/lokales-datum`.
- **R3-05 CSV:** Semikolon als Trenner (deutsches Excel), Zellen nach RFC 4180 in Anführungszeichen,
  Formeln entschärft, Temperatur und Wind als eigene Zahlenspalten mit Dezimalkomma (`csvZelle`).
- **R3-06 OSM:** Kachel-Adressen und Namensnennung in `src/lib/kacheln.ts`; Flugplaner und Flugspur
  laden von `tile.openstreetmap.org` (ohne a/b/c) mit Namensnennung, die Hauptkarte nennt HOT und
  OSM France. Android meldet sich als „SkyLogDE“ (`appendUserAgent`, native Nominatim-Abfragen mit
  `appKennungKopf()`); CSP und Kachel-Cache angepasst.
- **R3-07 SORA:** volle iGRC-Tabelle nach SORA 2.5 mit Minderungen je Robustheit vom Branch
  `check2/sora-igrc` übernommen (Konflikt mit den Texten aus Runde 9/10 gelöst).
- **R3-08 Offline-Karten im Browser:** Download in 4-MiB-Teilstücken per Range (Vercel-Funktionen
  dürfen höchstens 4,5 MB liefern); gegen GitHub geprüft (206). Der Karten-Proxy hat jetzt eine
  Zeitgrenze.
- **R3-09 Logbuch:** Wochen-Diagramm in CSS statt recharts – beim ersten Öffnen 36 statt 138 kB gzip.
- Die alten Branches `check2/lokales-datum`, `check2/sora-igrc` und `check2/n19-aufteilen` sind damit
  überholt. Die echten IndexedDB-Tests von `check2/n14-testabdeckung` sind inzwischen übernommen;
  der Branch kann entfallen.

Runde 13 (Branch `check4/niedrige-befunde`), die niedrigen Befunde R3-10 bis R3-13:
- **R3-10:** Datenschutzerklärung auf Englisch (`public/privacy.html`, Link je nach App-Sprache,
  offline im Service Worker); die deutsche Fassung duzt jetzt wie die App. Beide verlinken sich
  gegenseitig; ein Wächter prüft Abschnitte, Du-Form und Kachel-Server in beiden Sprachen.
- **R3-11:** Im Dunkelmodus wird nur die Grundkarte abgedunkelt (`.karte-grundlage` in
  `src/index.css`, Klasse aus `src/lib/kacheln.ts`, auch für die Offline-Karte) – Geozonen,
  Flugspuren und Marker behalten ihre Farben.
- **R3-12:** Karten-Marker mit unsichtbarer Tippfläche (eigener Standort und Lieblingsorte 44 px,
  Flüge 28 px), das Symbol bleibt klein. axe-Regel target-size (WCAG 2.2) ohne Befund.
- **R3-13 – geprüft, bewusst zurückgestellt:** TypeScript 7.0.2 prüft den Code fehlerfrei (Probelauf
  per `npx`, nicht installiert), aber typescript-eslint 8 unterstützt nur TypeScript < 6.1, und
  TS 7 bringt die alte Compiler-API nicht mehr mit – Umstieg, sobald typescript-eslint so weit ist.
  pmtiles 4 geht erst, wenn protomaps-leaflet es unterstützt (5.1 verlangt pmtiles ^3). Vite 8.3.5
  und lucide-react 1.61 sind erst seit dem 21.10. veröffentlicht – frühestens Anfang November
  nachziehen (zwei Wochen Abstand zu neuen Versionen).
- Offen aus Check 3: nur R3-02 (Name, Anschrift, E-Mail und Hosting-Anbieter in beiden Fassungen
  der Datenschutzerklärung eintragen; danach juristisch gegenlesen lassen).

Runde 14 (Branch `check4/feinschliff`), Feinschliff nach Bildschirmfotos vom 22.10.:
- **Karten-Namensnennung:** auf der Hauptkarte kurz („© OpenStreetMap · HOT · OSM France“) und ohne
  „Leaflet“-Vorsatz – sie passt am Handy in eine Zeile und wird nicht mehr von den Karten unten
  verdeckt (seit Runde 12 war die erste Zeile verdeckt); im Dunkelmodus dunkel hinterlegt.
  Oberflächentest `e2e/karte.spec.ts` (hell und dunkel).
- **Sicherheitskopie vor dem Ersetzen (Idee E19):** Beim Einspielen im Modus „Ersetzen“ liest die App
  die Datei zuerst (auch verschlüsselt), zeigt Inhalt und Zeitraum und legt nach der Bestätigung
  automatisch `skylog_vor_wiederherstellung_<Datum>.json` an. Scheitert die Kopie, wird nichts
  ersetzt. `leseSicherung`, `beschreibeSicherung`, `sichereVorDemErsetzen` in `backup.ts`;
  Komponententest `src/views/EinstellungenView.test.tsx`.
- **Laptop:** Flugplaner und SORA-Assistent ab 1024 px zweispaltig (Dialogbreite `xxl`): Karte bzw.
  Grundangaben links, Einstellungen bzw. Minderungen rechts.
- **Tests:** Komponententests für SORA-Assistent (iGRC aus Table 1, M1(A)-Sperre, Ergebnis) und
  Kundenverwaltung (`src/components/dialoge.test.tsx`).

Runde 15 (Branch `check5/schwaechen`), die „Schwäche“-Spalte der Bereichsbewertung, soweit im Code lösbar:
- **Start:** Sicherungslogik, EU-Zonen (Parser, Länderliste, Zeichnung), Offline-Karten-Suche und
  Benachrichtigungen werden erst nach dem ersten Bild nachgeladen (`sicherungsStand.ts` für das
  Datum der letzten Sicherung). Erststart 176,9 → 170,2 kB gzip, Haupt-Chunk 348 → 327 KiB. Den Rest
  machen React (198 KiB roh) und Leaflet aus. Lighthouse-A/B lief, war bei 50–60 % Rechnerlast aber
  nicht aussagekräftig (Blockierzeit derselben Fassung 2,3–5,0 s) und wurde abgebrochen.
- **Laptop:** auch Statistik und Import zweispaltig (Dialogbreite `xxl`).
- **Design:** Die Offline-Karte nimmt im Dunkelmodus den echten dunklen Protomaps-Stil
  (`useDunkelmodus`), Ortsnamen in der App-Sprache; nur die Online-Kacheln bleiben gefiltert (für
  dunkle Online-Kacheln bräuchte es einen weiteren Anbieter – Entscheidung offen).
- **Texte:** rund 30 Texte, die nur auf Deutsch dastanden, übersetzt (PIN-Sperre, Statistik, Import,
  e-ID, EU-Zonen, Fotos, Flugspur, Offline-Karten, Staffelmatrix, Lieblingsorte – dort auch
  „Favorit Hinzufügen“ → „Favorit hinzufügen“).
- **Barrierefreiheit:** PIN-Tasten „C“/„⌫“ beschriftet, Eingabe-Fortschritt wird angesagt.
- **Tests:** Komponententests für Statistik, Import, Ortswahl, Lieblingsorte, Datensicherung,
  PIN-Sperre, Behörden-Check, Risiko-Einordnung und Mehr-Menü (`dialoge2/3.test.tsx`).
- **Nicht im Code lösbar (braucht dich oder andere):** juristische Prüfung der Rechtstexte,
  Screenreader-Test auf einem Gerät, Vercel-Deploy (KI-Check in der APK, Offline-Karten im Browser,
  Lighthouse auf Vercel), Angaben in der Datenschutzerklärung (R3-02), Entscheidung zur
  Android-Systemsicherung.

Runde 10 (Branch `check3/schwaechen`), die Schwächen der Bereichsbewertung im Dashboard:
- **Barrierefreiheit:** axe-Audit über 22 Ansichten/Dialoge – die letzten drei Verstöße behoben
  (Auswahlfeld im Flugplaner ohne Namen, Behörden-Check als Dialog mit Überschrift, Wetterleiste
  im Assistenten per Tastatur scrollbar). Lighthouse: Barrierefreiheit 100, SEO 100.
- **Tablets:** Drohnen-, Inventar- und Wissenslisten zweispaltig, Akkus dreispaltig ab 768 px.
- **Texte:** Großschreibfehler („Eintrag Hinzufügen“, „Kunde Speichern“, „Parameter Ändern“ …),
  Bindestriche („Firmware-Version“, „Akku-Nummer“, „LBA-Wissen“), englische Satzschreibung.
  Ein Englisch-Durchlauf über alle 22 Ansichten findet nur noch Beispieldaten.
- **Technik:** weitere Komponententests (Drohne anlegen, Wartung eintragen/löschen, Notfall-
  Koordinaten, Standort-Hinweis, Checklisten-Editor).
- **Leistung:** nicht weiter verändert – Lighthouse lief am 21.10. bei 100 % CPU-Last durch andere
  Programme (Antigravity, Explorer, OneDrive) und war nicht vergleichbar. Nächster Schritt:
  auf ruhigem Rechner oder mit PageSpeed Insights nach dem Vercel-Deploy messen.

Runde 9 (Branch `check2/d03-k01`), die zwei „teilweise“-Punkte aus Runde 1:
- **K01/N19 große Dateien:** FlightAssistant 1.068 → 356 Zeilen (Schritte und Karten in
  `src/views/flugAssistent/`), GarageView 865 → 283 (`src/views/flotte/`, Wartungslogik als reine
  Funktion `wartungsHinweise`), LogbookView 731 → 303 (`src/views/logbuch/`, `flugAusFormular`),
  App.tsx 828 → 728 (Standort/Wetter im Hook `src/lib/useStandort.ts`). Größte Datei ist jetzt
  App.tsx. Komponententests sichern „Flug speichern“ in Assistent und Logbuch ab.
- **Dabei behoben:** „Flug abschließen“ bei laufendem Timer verlor den laufenden Abschnitt; nach
  dem Stoppen zählte die Gesamtflugzeit den letzten Abschnitt doppelt; Wartungshinweise der
  Flotte aktualisieren sich nach neuen Einträgen.
- **Regel-Check:** Bestandsdrohnen ab 250 g fliegen seit 1.1.2024 nur in A3 – die App stufte sie
  bis 500 g noch in A1 ein (`src/services/offeneKategorie.ts`, mit Tests).
- **D03 Typografie:** Großschrift 72 → 23 (nur Abschnittsüberschriften und Abzeichen),
  `font-black` 74 → 46 (nur Titel/große Zahlen), Formular-Labels 12 px in normaler Schreibung.
  `src/designRegeln.test.ts` wacht darüber (Regeln in DESIGN.md).

Runde 8 (Branch `check2/restliche-befunde`), restliche Befunde N07–N23 aus dem zweiten Check:
- **N10 eine Checkliste:** Der Flug-Assistent nutzt nur noch die anpassbare Vorflug-Liste als
  Startfreigabe („Startklar – Flug starten"); die fest eingebaute 13-Punkte-Liste ist weg.
  Standardliste um Fernsteuerung, Gimbal-Schutz und Homepoint/120 m ergänzt, Standardpunkte
  erscheinen auf Englisch übersetzt (`punktText` in `checklists.ts`).
- **N11 Standort:** Abfrage erst nach Erklärung (Hinweis „Standort freigeben?" auf der Karte,
  `services/standortFreigabe.ts`); Nutzer mit erteilter Freigabe sehen ihn nicht. Notfall-
  Koordinaten nur, wenn der Standort echt ist (GPS oder von Hand) – nie Startort oder Berlin.
- **N12 Speicher:** installierte Web-App fordert dauerhaften Speicher an; Einstellungen zeigen
  Status, Belegung und einen Knopf (`services/speicherSchutz.ts`).
- **N13 Header:** CSP, nosniff, Referrer-/Permissions-Policy, Frame-Schutz und ein Jahr Cache
  für `/assets` in `vercel.json` und `server.ts` (eine Liste: `api/_lib/sicherheitsHeader.ts`,
  Abgleich-Test in `konfiguration.test.ts`). Neue externe Dienste dort in `connect-src` ergänzen!
  KI-Endpunkt prüft die Herkunft (`herkunftErlaubt`, Zusatz-Adressen per `SAFETY_CHECK_ORIGINS`).
  Lokal mit Service Worker und PDF-Export ohne CSP-Verstöße getestet. `server.ts` nimmt `PORT`.
- **N14 Tests + SORA-Korrekturen:** SORA 27 → 97 %, CRM 6 → 96 % Abdeckung. Dabei gefunden und
  behoben: SAIL-Matrix wich von JARUS SORA 2.5 ab (ARC-d gab SAIL V statt VI, ARC-c mit kleinem
  GRC SAIL III statt IV); OSO-Liste war frei nummeriert – jetzt die OSO-Tabelle der
  EASA-Übersicht mit Robustheit je SAIL; M3 entfällt (in SORA 2.5 gestrichen, Notfallplan in
  OSO #08); 250-g-Regel; ARC-c über besiedeltem Gebiet; GRC > 7 als „außerhalb SORA".
- **N09 Kontrast:** `slate-400`/`slate-500` im hellen Modus abgedunkelt (≥ 4,7 : 1 auch auf
  `slate-100`), Zähler-Abzeichen auf `brand-red`, Kontrast-Wächter auf 4,5 : 1.
- **N15 Englisch:** Erinnerungen, Wartungshinweise und -gründe, Wetter, Zonen-Urteil und
  -typen, Luftfahrtwetter, Behördenverzeichnis, Roadmap, Vorflug-Sicherheitscheck, EU-Zonen.
  Ein Scan im englischen Modus findet nur noch Nutzer- und amtliche Zonendaten.
- **Kleinere:** N07 Beschriftungen im Assistenten, N08 Ansichten per Tastatur scrollbar,
  N16 Text zur Android-Sicherung, N17 Tablet-Breite, N18 Marker-Namen und Überschriften,
  N20 `npm audit` 0 (Override für `uuid`), N21 Titel/Beschreibung/robots.txt, N22 KI-Knopf
  ohne Dauerpulsieren, N23 Panel-Farben aus der Palette.

Runde 7 (Branch `design/einheitliches-design`), Befunde N01–N06 aus dem zweiten Check:
- **N01 Android-Standort:** ACCESS_FINE/COARSE_LOCATION + `uses-feature gps required=false`
  im Manifest (Capacitor fragt die Freigabe zur Laufzeit an). Auf einem Gerät noch nicht getestet.
- **N02 Zurück-Taste:** `@capacitor/app` + Ebenen-Stapel (`services/ebenen.ts`, `lib/useEbene.ts`):
  Zurück/Escape schließen nur die oberste Ebene, dann geht es zur Karte, erst dort wird die App
  minimiert. Der Flug-Assistent fragt, bevor ein aufgezeichneter Flug verworfen wird.
  Feste z-Ordnung in DESIGN.md (Vollbild 60 < Dialog 70 < Bild 90 < Hinweis 95 < Rückfrage 150 < PIN 200).
- **N03 GPS:** `watchPosition` nur auf Karte und Sicherheit und nur im Vordergrund; Wetter nur
  bei >10 min oder >2 km neu; kleine Sprünge (<15 m) ignoriert. Distanz-Helfer in `services/geo.ts`.
- **N04 Datenschutz:** Nominatim-Ortsname, DIPUL-Kartenausschnitt, GPS-Nutzung und
  Android-Systemsicherung ergänzt (`public/datenschutz.html`).
- **N05 Zoom:** Viewport ohne `user-scalable=no`/`maximum-scale`; Felder auf Touch-Geräten 16 px
  (kein iOS-Eingabezoom); `<html lang="de">` + Sprache folgt der Einstellung.
  `src/konfiguration.test.ts` bewacht Manifest und Viewport.
- **N06 Start:** Offline-Karten-Bibliothek lazy (vendor-maps nicht mehr im Erststart),
  registerSW `defer`, Preconnect zu Kachel- und DIPUL-Server. A/B-Messung (Lighthouse, Handy,
  komprimiert, je 4 Läufe abwechselnd): FCP 2,5 → 2,1 s, Speed Index besser, übertragen
  529 → 494 KiB; Punktzahl gleich (Median 65), LCP schwankt 3,3–5,3 s, weil das größte Element
  eine OSM-Kachel ist. Großer Hebel bleibt eine leichtere Startseite statt der Karte.

Runde 6 (Branch `design/einheitliches-design`): alle 30 Befunde des Software-Checks
(Dashboard „SkyLog Software-Check") bearbeitet:
- **Logbuch:** Kopf-Aktionen auf dem Handy erreichbar (vorher außerhalb des Bildschirms),
  Export/Import/Statistik hinter „⋯", Suche + Filter (Drohne, Zweck), Hinweise als eine
  aufklappbare Karte mit „In 7 Tagen erinnern" (`ausgeblendeteHinweise.ts`, Reminder haben
  jetzt einen stabilen `schluessel`), Formular vorbelegt und mit Zweck, Karten mit
  sichtbarem Löschen.
- **Rückgängig statt Rückfrage** (`services/rueckgaengig.ts` + `HinweisLeiste`): Flüge,
  Drohnen, Akkus, Wartung, Dokumente, Ersatzteile, Piloten. `dbService.restoreFlight`
  zählt Akku-Zyklen nicht doppelt.
- **Navigation:** ein Menü nach dem Ablauf (`components/AppNavigation.tsx`), Karte in
  `components/DroneMap.tsx` ausgelagert (App.tsx 1.187 → ~740 Zeilen, ohne Karte und Menü). „Flug loggen"
  öffnet direkt das Formular. Karte startet ohne GPS am letzten Flugort (`startOrt.ts`).
- **Profil/Einstellungen getrennt:** neue Ansicht `EinstellungenView` (Darstellung, PIN,
  Datensicherung, NOTAM eingeklappt, Kalender, Beispieldaten, Über die App).
- **Version** kommt aus `package.json` (`__APP_VERSION__` in vite.config.ts), im Release aus dem
  Git-Tag; Plattform über Capacitor (`lib/appInfo.ts`); Android-Debug-APK heißt `x.y.z-buildN`.
- **Sicherheit:** 112-Knopf und Koordinaten im Notfall-Leitfaden, Verbotszonen genauer
  (Wohngrundstücke, 100-m-Abstände) mit Link auf § 21h LuftVO und dipul.
- **Texte:** durchgehend „du", deutsche Begriffe statt „Safety Hub/Setup/Review/Score",
  echte Umlaute, Rückfragen und Meldungen übersetzbar.
- **Design:** Begrüßung als Dialog, gleichfarbige Kennzahlen, Diagrammfarben über
  CSS-Variablen (11 px), Versalien von 163 auf 75 Stellen, Pilotenformular hell,
  KI-Analyse hell, motion-Bibliothek entfernt (CSS-Einblendungen `.ansicht-ein`).
- **Installation:** PNG-Icons 192/512/maskable + apple-touch-icon (`scripts/icons-erzeugen.mjs`),
  Manifest ohne „LBA-konform", Theme-Farbe = Markenblau, PDFs im Markenblau.

## Noch offen (braucht dich)
- ~~**SORA-Boden-Risiko (iGRC)**~~ – erledigt: Die volle SORA-2.5-Tabelle (Abmessung,
  Geschwindigkeit, Bevölkerungsdichte) und die Minderungen M1(A)/M1(B)/M1(C)/M2 sind in
  `src/services/sora25.ts` umgesetzt und werden im Dialog abgefragt.
- ~~**N16 Android-Sicherung**~~ – entschieden am 2026-10-24: Die App-Daten sind von der
  Google-Kontosicherung ausgenommen (`dataExtractionRules`/`fullBackupContent`), der lokale
  Gerätewechsel bleibt erlaubt.
- **Nach dem Vercel-Deploy:** einmal die Browser-Konsole auf CSP-Meldungen prüfen.
- **Vercel-Deployment** einrichten (GEMINI_API_KEY dort setzen), dann Repo-Variable
  `SKYLOG_API_URL` auf die Adresse setzen → KI-Check auch in der APK.
- ~~**Projekt aus OneDrive verschieben**~~ – erledigt am 2026-10-24; es liegt jetzt unter
  `C:\Users\lukas\Projekte\SkyLog`.
- **Datenschutzerklärung und Rechtstexte juristisch gegenlesen lassen** (`public/datenschutz.html`,
  Verbotszonen in `SafetyView.tsx`) – vor einer öffentlichen Verteilung. Die Kontaktdaten sind
  eingetragen; eine vollständige Postanschrift (Straße, PLZ) wäre für die Rechtssicherheit besser.
- ~~**DJI-SRT-Import mit echter Datei gegenprüfen**~~ – erledigt am 2026-10-24 mit zehn echten
  Dateien; die unterstützten Formate stehen im Nachtrag oben.
- **Neues Release** (z. B. `v1.3.0`) nach dem Merge von Runde 9.

## Technik-Stack
- **Frontend:** React 19 + Vite 8 + TypeScript 6 (strict) + Tailwind 4
- **Karte:** Leaflet + react-leaflet, Offline-Karten via `pmtiles` / `protomaps-leaflet`
- **Speicher:** IndexedDB (`idb`, DB v12), Backup als JSON (optional AES-256-GCM)
- **PDF/QR:** `jspdf`, `qrcode` · **Charts:** `recharts` (nur lazy)
- **KI:** `@google/genai` (Gemini) – nur für den Sicherheitscheck, server-seitig
- **Server:** `server.ts` (Express) + Vercel-Funktionen in `api/`, gemeinsame Logik in `api/_lib/`
- **Mobil:** Capacitor 8 → Android-APK (GitHub Actions `android.yml`, Release `release.yml`)
- **Design:** siehe `DESIGN.md` (Bausteine in `src/components/ui`); Dunkelmodus über die
  Palette in `src/index.css`.

## Starten (Dev)
```bash
npm install
npm run dev      # tsx server.ts, Port 3000
npm test         # vitest
npm run check    # typecheck + lint
npm run e2e      # Playwright (baut vorher die App)
npm run build && npm start   # gebaute Fassung inkl. CSP auf Port 3000
npm run sync:android   # build + cap sync android (für APK)
```

## Struktur
- `src/App.tsx` – Shell, Zustand, Navigation, Dialog-Verwaltung
- `src/components/DroneMap.tsx` – Startkarte · `AppNavigation.tsx` – Menü, Seitenleiste, Navigation
- `src/views/` – Logbuch, Flotte, Flug-Assistent, Sicherheit, Profil, Einstellungen, Wissen/Inventar/Piloten, Roadmap
- `src/services/` – ~50 Fachmodule, fast alle mit Tests
- `src/components/` – Dialoge/Panels und `ui/` (Dialog, Knopf, Feld, SeitenKopf …)
- `api/` – Vercel-Funktionen + gemeinsame Server-Logik (`_lib/`)
