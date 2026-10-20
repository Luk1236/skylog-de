# SkyLog DE – Weiterarbeit-Briefing

**Für einen neuen Chat: diese Datei zuerst lesen.** Der alte
`../SkyLog-Sicherung/WIEDERAUFBAU-Fahrplan.md` ist erledigt und nur noch Historie.
Zuletzt aktualisiert: 2026-10-20 (Runde 4).

## Worum es geht
Drohnen-Flugbuch-App („die Handy-App für die Drohne"). Ursprüngliches Ziel war, die
funktionsreichste Handy-Version (APK vom 22.05.2026, Quelltext verloren) nachzubauen.
Das ist erreicht und inzwischen deutlich übertroffen. Weitergearbeitet wird **hier** in
`skylog-de-verbessert`.

- **Repo:** GitHub `Luk1236/skylog-de` · Hauptbranch `master`
- **APK vom 22.05.2026 gesichert:** `../SkyLog-Sicherung/skylog-handy-2026-05-22.apk`
  (am 2026-10-19 vom Handy kopiert; App-ID `com.skylog.app`). Enthält nur das
  minifizierte Bundle, keine Source-Maps – Quelltext lässt sich daraus nicht zurückgewinnen.
- `../skylog-handy` ist der alte Prototyp (Repo `Luk1236/Flug`, 3 Commits) – überholt.

## Stand 2026-10-20
Verifiziert: `tsc` (strict) sauber · ESLint 0 Warnungen · **500 Unit-Tests** (46 Dateien) ·
**50 Playwright-Tests** · `npm run build` Exit 0. CI: Job `check` (Typecheck, Lint, Unit) und
Job `e2e` (Playwright inkl. Kontrast-Wächter). Release per Tag `v*.*.*` (`release.yml`).

Vierte Runde 2026-10-20 (Branch `ausbau/laptop-demo-kalender`):
- **Laptop (lg+):** Seitenleiste mit allen Ansichten, Werkzeugen und Einstellungen statt Mehr-Popup;
  Kopfzeile zeigt den Ansichtsnamen; Logbuch ab xl zweispaltig. Werkzeuglisten einmal definiert.
- **Demo-Modus** (`demoDaten.ts`, IDs mit `demo-`), **Einrichtungs-Assistent**, **.ics-Export** (`kalender.ts`).
- **Englisch** jetzt auch für die Fach-Dialoge (235 Texte); Rechtstexte bleiben deutsch.
- **Vercel:** Proxys (Luftfahrtwetter, Zonen, Karten) als Funktionen, Logik gemeinsam mit server.ts
  in `api/_lib/proxys.ts`. Deployen + `SKYLOG_API_URL` setzen bleibt Aufgabe des Nutzers (Konto).

Dritte Runde 2026-10-20 (Branch `ausbau/veraltet-verbessern-erweitern`):
- **Updates:** Vite 8, Vitest 5, TypeScript 6 (+ `strict`), ESLint 10, Express 5, lucide 1.x,
  motion 14, Gemini-SDK 2.30 + stabiles Modell `gemini-3.8-flash` (per `GEMINI_MODEL`).
  Bewusst zurück: TypeScript 7 (typescript-eslint < 6.1), pmtiles 4 (protomaps-leaflet will 3),
  @types/node 26 (CI läuft auf Node 22). `.npmrc legacy-peer-deps` wegen optionaler Peer-Kette.
- **`@types/react` fehlte komplett** → React war `any`, Typecheck prüfte in Komponenten nichts.
  Nachgerüstet; dabei 2 Bugs: Erinnerungs-Zähler in der Navigation blieb immer leer, Karten-Popup.
- **PIN:** PBKDF2-SHA256 (310k, Zufallssalz), Wartezeit nach Fehlversuchen, v1 wird migriert;
  ehrlich als „Bildschirmsperre" (verschlüsselt die Daten nicht).
- **Attrappen ersetzt:** Ersatzteil-Inventar statt Bambu/STL-Platzhaltern (DB v12);
  „Auto Cloud-Backup" → „Datensicherung" mit AES-256-GCM-Export (Android: Teilen-Menü);
  Backup-Format 2 inkl. Flugpläne/Favoriten/Kunden/Ersatzteile; „LBA Konform" → „Daten nur lokal".
- **Erststart ~40 % kleiner** (Ansichten lazy, recharts ohne festen Chunk).
- **Flächenraster** für beliebige Vielecke, freie Richtung, Bahnabstand aus Kamera.
- **Android-Benachrichtigungen** für Lizenz, Garantie, Wartung, Sicherung (`benachrichtigungen.ts`).
- **Releases:** `release.yml`; `versionCode` jetzt = Zahl der Commits (in beiden Workflows gleich).
- **Dialog-Kontrast:** `.immer-dunkel` für bewusst dunkle Dialoge; Kartenelemente lagen mit
  z-[400]/[500] über Dialogen → z-20/30.
- **Englisch:** 305 Texte der Hauptansichten (`tx('de', 'en')` aus `useSprache`).
- **Datenschutz:** e-ID-QR lokal statt api.qrserver.com; `datenschutz.html` auf aktuelle
  Dienste (u.a. Gemini, NOAA, Nominatim) – **bitte rechtlich gegenlesen**.

Zweite Runde 2026-10-19 (dringende Punkte):
- **Feste APK-Signatur:** Schlüssel in `../SkyLog-Sicherung/android-signatur/` (LIESMICH dort),
  als GitHub-Secrets `SKYLOG_KEYSTORE_BASE64` / `_PASSWORD` / `SKYLOG_KEY_ALIAS`. `versionCode`
  = Laufnummer des Workflows. Ohne Secret bricht der APK-Bau bewusst ab.
  **Einmalig auf dem Handy:** Backup exportieren → alte App deinstallieren → neue APK → Backup importieren.
- **EU-Geozonen:** 26 von 28 Direktadressen waren geraten (404/HTML) → entfernt, nur CH und LU
  geprüft. Der Proxy erfand bei toten Quellen eine „amtliche" Verbotszone über Berlin – entfernt;
  solche Einträge werden beim Laden aus der DB gelöscht (`istErfundeneErsatzzone`). Nativ lädt
  die App direkt von der Quelle. DE-Portal-Link war tot → `maptool-dipul.dfs.de`.
- **KI-Check in der APK:** `src/lib/apiBase.ts`; die APK nimmt `VITE_API_BASE` aus der
  Repo-Variable `SKYLOG_API_URL`. **Offen:** Es gibt noch kein Vercel-Deployment – erst
  deployen, dann Variable setzen, sonst zeigt die APK einen Hinweis statt der Analyse.
- **Sicherheit:** alle 17 `npm audit`-Meldungen behoben (keine Major-Updates).
- **CI-Fix:** `setup-android` mit `packages: platform-tools` (Paket `tools` gibt es nicht mehr).

Erste Runde (Branch `aufraeumen/sicherheit-und-abnahme`):
1. **KI-Endpunkt abgesichert:** Logik von `server.ts` und `api/safety-check.ts` in
   `api/_lib/safetyCheck.ts` zusammengeführt (mit Tests). Neu: Eingabeprüfung
   (Zahlen, Wertebereich, 0/0 erlaubt), Ortsname gesäubert (Prompt-Injection),
   Rate-Limit (10/h pro IP, 300/Tag gesamt; per `SAFETY_CHECK_PER_HOUR` /
   `SAFETY_CHECK_PER_DAY` anpassbar), 503 ohne API-Schlüssel, 429 mit `Retry-After`,
   Body-Limit 10 kB. Die App zeigt für 429/503 eigene Hinweise.
   Hinweis: Das Limit liegt im Speicher je Instanz – auf Vercel eine Bremse, keine
   harte Kostengrenze. Harte Grenze: Kontingent/Budget im Google-AI-Studio setzen.
2. **Lint 61 → 0 Warnungen:** ungenutzter Code entfernt, `any` durch echte Typen ersetzt;
   bewusst gesetzte Hook-Abhängigkeiten mit Begründung kommentiert. Rohes externes JSON
   (Zonen, METAR, NOTAM, ED-269) behält begründetes `any`; in Tests ist `any` erlaubt.
3. **Fix ED-269:** `'RED'` wurde per `includes` auch in `AUTHORISATION_REQUIRED` gefunden
   → solche Zonen galten fälschlich als Verbotszone. Jetzt Wortgrenze, mit Test.
4. **Hell/Dunkel-Abnahme im Browser** (alle Hauptansichten + „Mehr"-Unterseiten,
   automatisierte Kontrastmessung + Screenshots). Behoben:
   - Dunkel: hellblaue/-orange Untertitel auf Brand-Flächen (1,7:1), Labels auf bewusst
     dunklen Panels (Gesamt-Kachel, Bambu-Panel), Schrittnummern im Notfall-Leitfaden.
   - Hell: weiße Schrift auf `amber-500`/`emerald-500` (GPS-Banner, Score-Knopf, Badges;
     ~2,5:1) → `-700`; Brand-Orange/-Grün eine Stufe dunkler; leerer Dokumente-Hinweis.
   - Gedämpfter Text (`text-slate-400`, 270× in der App) von 2,5:1 auf ~4,1:1 – bewusster
     Kompromiss, weil derselbe Ton auch auf dunklen Dialogen steht (dort ~4,4:1).
   - Dunkelmodus: alle geprüften Ansichten ≥ 4,5:1. Dialoge wurden nicht einzeln gemessen.

## Technik-Stack
- **Frontend:** React 19 + Vite 6 + TypeScript + Tailwind 4
- **Karte:** Leaflet + react-leaflet, Offline-Karten via `pmtiles` / `protomaps-leaflet`
- **Speicher:** IndexedDB (`idb`), Backup als JSON
- **PDF/QR:** `jspdf`, `qrcode` · **Charts:** `recharts`
- **KI:** `@google/genai` (Gemini) – nur für den Sicherheitscheck, server-seitig
- **Server:** `server.ts` (Express, tsx) + `api/safety-check.ts` (Vercel), gemeinsame Logik in `api/_lib/`
- **Mobil:** Capacitor 8 → Android-APK (Build via GitHub Actions `.github/workflows/android.yml`)
- **Dark Mode:** `data-theme="dark"` auf `<html>`; `src/index.css` definiert die Palette im
  Dark-Scope um (Slate invertiert, Signaltöne aufgehellt). Neue Farbkombis dort prüfen.

## Starten (Dev)
```bash
npm install
npm run dev      # tsx server.ts, Port 3000
npm test         # vitest
npm run check    # typecheck + lint
npm run sync:android   # build + cap sync android (für APK)
```

**Bekannte Probleme:**
- Ohne `GEMINI_API_KEY` in `.env` (Vorlage `.env.example`) antwortet der KI-Check mit 503;
  der Rest der App läuft.
- **OneDrive-Flakiness:** Das Projekt liegt unter `OneDrive\Desktop`. Bei viel Datei-I/O
  schlagen Build/Tests gelegentlich mit `UNKNOWN: unknown error, read` bzw. `spawn UNKNOWN`
  fehl – beim zweiten Lauf sauber. Dauerhaft: Ordner aus OneDrive nehmen bzw. von der
  Synchronisierung ausschließen.
- Browser-Vorschau im Hintergrund: Motion-Einblendungen bleiben dort bei Deckkraft 0 hängen
  (nur in der Testumgebung, nicht in der echten App).

## Struktur
- `src/App.tsx` (~1.150 Zeilen) – Shell, Navigation, Karte
- `src/views/` – FlightAssistant, GarageView, LogbookView, ProfileView, SafetyView,
  RoadmapView, InfoViews
- `src/services/` – ~40 Fachmodule, fast alle mit Tests
- `src/components/` – ~27 Dialoge/Panels
- `api/` – Vercel-Funktion + gemeinsame Server-Logik (`_lib/`, nicht als Route veröffentlicht)

## Noch offen
- **Release-Workflow** einmal mit echtem Tag ausprobieren (`git tag v1.1.0 && git push origin v1.1.0`).
- **DJI-SRT-Import mit echter Datei gegenprüfen** (`djiSrt.ts`). Braucht eine Beispiel-SRT
  vom Nutzer. (DJI-Fly-`.txt`/DAT-Logs sind verschlüsselt.)
- **Kontrast-Wächter erweitern** auf Dialoge, die Daten brauchen und deshalb noch nicht im
  Test sind (Akku-Details, Flug-Track, Statistik, Medien, Favoriten, Flug-Import): in
  `e2e/kontrast.spec.ts` vorher Testdaten anlegen. Neue bewusst dunkle Dialoge bekommen
  die Klasse `immer-dunkel`.
- **Vercel-Deployment** einrichten (GEMINI_API_KEY dort setzen), dann Repo-Variable
  `SKYLOG_API_URL` auf die Adresse setzen → KI-Check auch in der APK. Achtung: Auf Vercel
  gibt es nur `/api/safety-check` – die Proxys `/api/zonen`, `/api/aviation`, `/api/karte`
  laufen nur mit `server.ts` (in der APK unnötig, dort geht alles nativ).
- **Weitere EU-Zonenquellen** nur nach echter Prüfung eintragen (Test „Direktadressen").
- **Projekt aus OneDrive verschieben** (Ort bestimmt der Nutzer); Origin-Prüfung für den KI-Endpunkt.
- **Große Themen (eigene Infrastruktur):** Cloud-Team-Sync, Live-Remote-ID/U-space, Push.
