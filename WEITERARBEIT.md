# SkyLog DE – Weiterarbeit-Briefing

**Für einen neuen Chat: diese Datei zuerst lesen.** Der alte
`../SkyLog-Sicherung/WIEDERAUFBAU-Fahrplan.md` ist erledigt und nur noch Historie.
Zuletzt aktualisiert: 2026-10-19.

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

## Stand 2026-10-19
Verifiziert: `tsc` sauber · **ESLint 0 Fehler, 0 Warnungen** · **471 Tests grün** (43 Dateien)
· `npm run build` Exit 0. CI (`.github/workflows/ci.yml`) prüft Typecheck + Lint + Tests.

Diese Runde (Branch `aufraeumen/sicherheit-und-abnahme`):
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
- **DJI-SRT-Import mit echter Datei gegenprüfen** (`djiSrt.ts`). Braucht eine Beispiel-SRT
  vom Nutzer. (DJI-Fly-`.txt`/DAT-Logs sind verschlüsselt.)
- **Dialoge einzeln auf Kontrast prüfen** (diese Runde nur Hauptansichten/Unterseiten).
  Mehrere Dialoge sind bewusst dunkel gestaltet und werden im Dunkelmodus hell invertiert –
  auf ähnliche Fälle wie die Gesamt-Kachel achten.
- **Optional:** Projekt aus OneDrive verschieben; Origin-Prüfung für den KI-Endpunkt,
  falls er öffentlich auf Vercel läuft.
- **Große Themen (eigene Infrastruktur):** Cloud-Team-Sync, Live-Remote-ID/U-space, Push.
