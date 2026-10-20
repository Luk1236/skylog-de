# SkyLog DE

Digitales Flugbuch für Drohnenpilot:innen in Deutschland – als Web-App und als Android-App.
Alle Daten bleiben lokal auf dem Gerät (IndexedDB); es gibt kein Konto und keine Cloud.

## Funktionen

- **Logbuch**: Flüge mit Legs, Akku, Wetter, Co-Pilot und Nachtflug, Suche und Filter. Dazu Statistik, Jahres-PDF (Betriebsnachweis), CSV/KML-Export und Import aus Airdata-CSV und DJI-SRT. Gelöschtes lässt sich ein paar Sekunden lang zurückholen.
- **Flotte**: Drohnen, Akkus (Zyklen und Gesundheit), Wartung mit Intervallen, Garantie und Kosten, Ersatzteil-Inventar.
- **Karte**: DIPUL-Geozonen, Offline-Karten (PMTiles), importierte EU-Geozonen (ED-269) und ein Zonen-Urteil mit Höhengrenzen.
- **Flug-Assistent**: Wetter mit Wind auf 120 m, bestes Flugfenster, METAR/TAF, NOTAM, Kp-Index, Checklisten und optional ein KI-Sicherheitscheck (Gemini).
- **Flugplaner**: Wegpunkt-Routen und Flächenraster für Mapping (beliebige Vielecke, freie Flugrichtung, Bahnabstand aus der Kamera). Export als GPX, KML oder Litchi-CSV.
- **Recht & Sicherheit**: QR-Behördencheck mit den gespeicherten PDF-Dokumenten, Notfall-Leitfaden mit 112-Knopf und Standort, Vorfall-Bericht für das LBA, SORA 2.5, Risiko-Check (A1/A2/A3/Specific), e-ID sowie ein Verzeichnis von Behörden und Rechtsquellen.
- **Datensicherung**: vollständiger Export, optional AES-256-verschlüsselt. In der Android-App geht die Datei über das Teilen-Menü direkt nach Google Drive, Nextcloud oder „Dateien“.
- **Erinnerungen**: in der App und auf Android als echte Benachrichtigung, z. B. Lizenzablauf, Garantie, Wartung und fällige Sicherung.
- **Hell/Dunkel**, Deutsch/Englisch (Rechtstexte bleiben bewusst deutsch) und eine PIN-Bildschirmsperre.
- **Demo-Modus** mit Beispieldaten, **geführte Ersteinrichtung** und **Fristen als Kalenderdatei (.ics)**.
- **Ein Menü nach dem Ablauf** (vor dem Flug, nach dem Flug, Verwaltung, Wissen & Konto) – auf dem Handy hinter „Mehr“, auf dem Laptop als Seitenleiste; Einstellungen getrennt vom Pilotenprofil.
- **Laptop-Layout** mit Seitenleiste für alle Ansichten und einem zweispaltigen Logbuch.

## Entwicklung

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev          # Express + Vite auf http://localhost:3000
npm test             # Unit-Tests (Vitest)
npm run e2e          # Oberflächentests im Browser (Playwright), inkl. Kontrast-Wächter
npm run check        # Typecheck (TypeScript strict) + ESLint
npm run build        # Web-App + Server-Bundle nach dist/
```

Für die Oberflächentests einmalig `npx playwright install chromium` ausführen.

Optional in `.env` (Vorlage: `.env.example`):

| Variable | Zweck |
|---|---|
| `GEMINI_API_KEY` | KI-Sicherheitscheck. Ohne Schlüssel antwortet der Endpunkt mit 503, der Rest der App läuft normal. |
| `GEMINI_MODEL` | anderes Gemini-Modell (Standard: `gemini-3.8-flash`) |
| `SAFETY_CHECK_PER_HOUR` / `_PER_DAY` | Limits des KI-Checks (Standard: 10 pro Stunde und IP, 300 pro Tag) |

## Android-App

Die App wird mit Capacitor gebaut, und zwar in GitHub Actions, nicht lokal:

- **Jeder Push auf `master`** baut eine Test-APK (Actions → „Android APK bauen“ → Artefakt `skylog-apk`).
- **Ein Versions-Tag** erzeugt ein Release mit signierter APK und Änderungsliste:
  ```bash
  git tag v1.1.0
  git push origin v1.1.0
  ```

Alle APKs tragen denselben festen Schlüssel (GitHub-Secrets `SKYLOG_KEYSTORE_BASE64`, `SKYLOG_KEYSTORE_PASSWORD`, `SKYLOG_KEY_ALIAS`). Die Versionsnummer ist die Zahl der Commits. Dadurch lässt sich jede neuere APK über jede ältere installieren, ohne Datenverlust.

Für den KI-Check in der APK muss die Server-Adresse (z. B. die Vercel-URL) als Repo-Variable `SKYLOG_API_URL` gesetzt sein.

Lokal: `npm run sync:android` baut die Web-App und überträgt sie ins Android-Projekt.

## Server / Deployment

- **Vercel** (empfohlen):
  1. Auf [vercel.com](https://vercel.com) „Add New → Project“ wählen und das Repo `Luk1236/skylog-de` importieren. Die Einstellungen stehen in `vercel.json`.
  2. Unter „Environment Variables“ `GEMINI_API_KEY` setzen.
  3. Nach dem Deploy die Adresse (z. B. `https://skylog-de.vercel.app`) in GitHub als Repo-Variable `SKYLOG_API_URL` eintragen. Dann funktioniert der KI-Check auch in der APK.

  Auf Vercel laufen alle Server-Teile als Funktionen: `api/safety-check`, `api/aviation/[art]`, `api/zonen/[land]` und `api/karte/[datei]`.
- **`server.ts`** (Express) bietet dieselben Endpunkte für den Betrieb auf einem eigenen Server. Die Logik liegt gemeinsam in `api/_lib/`. In der Android-App sind die Proxys nicht nötig, weil dort alles nativ abgerufen wird.

## Aufbau

```
src/views/       Ansichten (Logbuch, Flotte, Profil, Flug-Assistent …), außer der Karte lazy geladen
src/components/  Dialoge und Panels (lazy geladen, s. lazyDialogs.tsx)
src/services/    Fachlogik, fast alles mit Unit-Tests
src/lib/         Sprache, API-Basis, Dateiausgabe
api/             Vercel-Funktion + gemeinsame Server-Logik (api/_lib)
e2e/             Playwright-Tests
android/         Capacitor-Android-Projekt
```

Notizen für die Weiterarbeit stehen in [WEITERARBEIT.md](WEITERARBEIT.md).

## Datenschutz

Flugdaten verlassen das Gerät nicht. Nur auf ausdrücklichen Wunsch gehen Anfragen an externe Dienste: Wetter, NOTAM, Zonenquellen, Kartendateien und – nur für den KI-Check – Koordinaten und Ortsname an Google Gemini. Details: `public/datenschutz.html`.
