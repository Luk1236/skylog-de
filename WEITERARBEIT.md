# SkyLog DE – Weiterarbeit-Briefing

**Für einen neuen Chat: diese Datei zuerst lesen.** Der alte
`../SkyLog-Sicherung/WIEDERAUFBAU-Fahrplan.md` ist erledigt und nur noch Historie.
Zuletzt aktualisiert: 2026-10-21 (Runde 9: große Dateien aufgeteilt, Typografie bereinigt).

## Worum es geht
Drohnen-Flugbuch-App („die Handy-App für die Drohne"). Ursprüngliches Ziel war, die
funktionsreichste Handy-Version (APK vom 22.05.2026, Quelltext verloren) nachzubauen.
Das ist erreicht und inzwischen deutlich übertroffen. Weitergearbeitet wird **hier** in
`skylog-de-verbessert`.

- **Repo:** GitHub `Luk1236/skylog-de` · Hauptbranch `master` · Releases per Tag `v*.*.*`
- **APK vom 22.05.2026 gesichert:** `../SkyLog-Sicherung/skylog-handy-2026-05-22.apk`
- `../skylog-handy` ist der alte Prototyp (Repo `Luk1236/Flug`) – überholt.

## Stand 2026-10-21
Verifiziert: `tsc` (strict) sauber · ESLint 0 Warnungen · **618 Unit-Tests** (63 Dateien, davon
Komponententests für Flug-Assistent und Logbuch) · **74 Playwright-Tests** inkl. Kontrast-Wächter
(WCAG AA 4,5 : 1), Handy-Abläufen (`e2e/ablauf.spec.ts`) und Ebenen/Zurück (`e2e/ebenen.spec.ts`).
Erststart ~175 kB gzip. Release v1.2.0 ist veröffentlicht (Runde 7); Runde 8 ist in master.

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
- **Version** kommt aus dem Git-Tag (`__APP_VERSION__` in vite.config.ts), Plattform über
  Capacitor (`lib/appInfo.ts`); package.json 1.1.0; Android-Debug-APK heißt `x.y.z-buildN`.
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
- **SORA-Boden-Risiko (iGRC)** ist weiter vereinfacht (Masse + Umgebung statt SORA-2.5-Tabelle
  mit Spannweite, Geschwindigkeit, Bevölkerungsdichte; M1/M2 pauschal −1). Der Dialog sagt das
  jetzt. Ob die volle Tabelle kommt, ist eine Produktentscheidung.
- **N16 Android-Sicherung:** bewusst entscheiden, ob `dataExtractionRules` die App-Daten von der
  Google-Sicherung ausnehmen sollen.
- **Nach dem Vercel-Deploy:** einmal die Browser-Konsole auf CSP-Meldungen prüfen.
- **Vercel-Deployment** einrichten (GEMINI_API_KEY dort setzen), dann Repo-Variable
  `SKYLOG_API_URL` auf die Adresse setzen → KI-Check auch in der APK.
- **Projekt aus OneDrive verschieben** (Ort bestimmst du) – OneDrive stellt gelöschte Dateien
  wieder her und lässt Builds gelegentlich mit `UNKNOWN: read` scheitern.
- **Datenschutzerklärung und Rechtstexte gegenlesen lassen** (`public/datenschutz.html`,
  Verbotszonen in `SafetyView.tsx`) – vor einer öffentlichen Verteilung.
- **DJI-SRT-Import mit echter Datei gegenprüfen** (`djiSrt.ts`).
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
npm run sync:android   # build + cap sync android (für APK)
```

## Struktur
- `src/App.tsx` – Shell, Zustand, Navigation, Dialog-Verwaltung
- `src/components/DroneMap.tsx` – Startkarte · `AppNavigation.tsx` – Menü, Seitenleiste, Navigation
- `src/views/` – Logbuch, Flotte, Flug-Assistent, Sicherheit, Profil, Einstellungen, Wissen/Inventar/Piloten, Roadmap
- `src/services/` – ~50 Fachmodule, fast alle mit Tests
- `src/components/` – Dialoge/Panels und `ui/` (Dialog, Knopf, Feld, SeitenKopf …)
- `api/` – Vercel-Funktionen + gemeinsame Server-Logik (`_lib/`)
