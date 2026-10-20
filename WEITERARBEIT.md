# SkyLog DE – Weiterarbeit-Briefing

**Für einen neuen Chat: diese Datei zuerst lesen.** Der alte
`../SkyLog-Sicherung/WIEDERAUFBAU-Fahrplan.md` ist erledigt und nur noch Historie.
Zuletzt aktualisiert: 2026-10-20 (Runde 7: dringende Befunde aus Software-Check 2).

## Worum es geht
Drohnen-Flugbuch-App („die Handy-App für die Drohne"). Ursprüngliches Ziel war, die
funktionsreichste Handy-Version (APK vom 22.05.2026, Quelltext verloren) nachzubauen.
Das ist erreicht und inzwischen deutlich übertroffen. Weitergearbeitet wird **hier** in
`skylog-de-verbessert`.

- **Repo:** GitHub `Luk1236/skylog-de` · Hauptbranch `master` · Releases per Tag `v*.*.*`
- **APK vom 22.05.2026 gesichert:** `../SkyLog-Sicherung/skylog-handy-2026-05-22.apk`
- `../skylog-handy` ist der alte Prototyp (Repo `Luk1236/Flug`) – überholt.

## Stand 2026-10-20
Verifiziert: `tsc` (strict) sauber · ESLint 0 Warnungen · **529 Unit-Tests** (54 Dateien) ·
**74 Playwright-Tests** inkl. Kontrast-Wächter, Handy-Abläufen (`e2e/ablauf.spec.ts`) und
Ebenen/Zurück (`e2e/ebenen.spec.ts`). Erststart ~173 kB gzip.

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
- **Vercel-Deployment** einrichten (GEMINI_API_KEY dort setzen), dann Repo-Variable
  `SKYLOG_API_URL` auf die Adresse setzen → KI-Check auch in der APK.
- **Projekt aus OneDrive verschieben** (Ort bestimmst du) – OneDrive stellt gelöschte Dateien
  wieder her und lässt Builds gelegentlich mit `UNKNOWN: read` scheitern.
- **Datenschutzerklärung und Rechtstexte gegenlesen lassen** (`public/datenschutz.html`,
  Verbotszonen in `SafetyView.tsx`) – vor einer öffentlichen Verteilung.
- **DJI-SRT-Import mit echter Datei gegenprüfen** (`djiSrt.ts`).
- **Neues Release** (z. B. `v1.2.0`) nach dem Merge.

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
