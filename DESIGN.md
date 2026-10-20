# SkyLog DE – Design-System

Ein Design für alle Ansichten und Dialoge, hell und dunkel. Der Dunkelmodus entsteht
**automatisch** über die Palette in `src/index.css` (Slate wird invertiert, Signalfarben
aufgehellt) – Komponenten verwenden dafür keine eigenen `dark:`-Klassen.

## Grundsätze

1. **Ein Dialog-Aufbau** für alles: `Dialog` aus `src/components/ui`. Keine eigenen
   Overlays, z-Werte oder Panels mehr.
2. **Helle Flächen, ein Akzent.** Primärfarbe ist `brand-blue`. Keine dunkel gestalteten
   Dialoge (`bg-slate-900` als Fläche) – der Dunkelmodus erledigt das für alle gleich.
3. **Bedeutung statt Deko.** Farben tragen Bedeutung (siehe unten), nicht Abwechslung.
4. **Lesbar auf dem Handy.** Kleinste Schrift 11 px (`text-2xs`), Touch-Ziele ≥ 40 px.

## Farben

| Rolle | Klasse | Einsatz |
|---|---|---|
| Primär | `brand-blue` | Hauptaktionen, aktive Navigation, Links, Akzent-Icons |
| Erfolg / bereit | `brand-green` (`emerald-*` für Flächen) | „startklar", „bereit", OK-Zustände |
| Warnung | `amber-*` (Text `amber-800` auf `amber-50`) | Hinweise, fällig, knapp |
| Gefahr | `brand-red` (`red-*` für Flächen) | Löschen, Fehler, Verbote, Notfall |
| Neutral | `slate-*` | Text, Ränder, Flächen |

Nicht verwenden: `sky-*`, `indigo-*`, `cyan-*`, `violet-*` als Akzente, feste Hex-Werte in
Klassen. Ausnahme: Diagramm-/Kartenfarben, die als Daten-Kodierung dienen.

## Typografie

| Rolle | Klassen |
|---|---|
| Seitentitel | `text-2xl font-black tracking-tight text-slate-900` (Komponente `SeitenKopf`) |
| Dialogtitel | `text-base font-black text-slate-900` (macht `Dialog`) |
| Abschnitt / Eyebrow | `text-2xs font-bold uppercase tracking-wider text-slate-500` |
| Kartentitel | `text-sm font-bold text-slate-900` |
| Fließtext | `text-sm text-slate-700` |
| Meta / Hinweis | `text-xs text-slate-500` |
| Kleinst (Badges, Achsen) | `text-2xs` (11 px) – nie kleiner |

Gewichte: `font-black` nur für Titel und große Zahlen, sonst `font-bold`/`font-medium`.

Versalien (`uppercase`) nur für Eyebrows und kleine Abzeichen-Beschriftungen, nie für Karten-
oder Abschnittstitel und nie für Knöpfe. Die untere Navigation steht in normaler Schreibung.

## Formen und Abstände

| Stufe | Rundung | Einsatz |
|---|---|---|
| Steuerelement | `rounded-xl` (12 px) | Knöpfe, Eingabefelder, Selects |
| Innen-Kachel | `rounded-2xl` (16 px) | Kacheln/Listeneinträge in einer Karte |
| Karte / Dialog | `rounded-3xl` (24 px) | Karten, Dialog-Panels, Banner |
| Pille | `rounded-full` | Badges, Status-Punkte |

Keine festen Pixel-Rundungen (`rounded-[32px]` …). Abstände in Tailwind-Schritten:
Karten `p-4`/`p-5`, Abstand zwischen Karten `gap-3`/`space-y-3`, Dialog-Innenrand `px-5`.

Schatten: Karten `shadow-sm`, schwebende Knöpfe/Leisten `shadow-lg`, Dialoge `shadow-2xl`.

## Bausteine (`src/components/ui`)

```tsx
import { Dialog, Knopf, Feld, eingabe, SeitenKopf, Abschnitt } from '../components/ui';

<Dialog titel="Datensicherung" untertitel="Export und Erinnerung" icon={DatabaseBackup}
        onClose={onClose} fuss={<Knopf voll onClick={speichern}>Speichern</Knopf>}>
  <Feld label="Name"><input className={eingabe} … /></Feld>
</Dialog>
```

| Baustein | Varianten | Hinweise |
|---|---|---|
| `Dialog` | `breite`: `sm` · `md` (Std.) · `lg` · `xl`; `ton`: `blau` · `gruen` · `bernstein` · `rot` (Icon-Kachel) | Unten aufsteigend auf dem Handy, zentriert ab `sm`. Escape und Klick daneben schließen. `role="dialog"`. |
| `Knopf` | `variante`: `primaer` · `sekundaer` · `gefahr` · `geist`; `groesse`: `md` (44 px) · `sm` (40 px); `voll`, `icon` | Ein `primaer` pro Bereich. |
| `knopfKlassen()` | wie `Knopf` | Knopf-Optik für Nicht-Buttons, z. B. das `<label>` einer Dateiauswahl. |
| `IconKnopf` | `variante`: `geist` · `gefahr` · `sekundaer`; `aria-label` Pflicht | Quadratisch 40 × 40 px, z. B. Löschen in Listen. |
| `Feld` + `eingabe` | – | Beschriftung über dem Feld, `htmlFor`/`id` setzen. |
| `SeitenKopf` | `titel`, `untertitel`, `aktionen` | Kopf jeder Ansicht. |
| `Abschnitt` | `titel`, `aktion` | Eyebrow-Überschrift über einer Gruppe. |
| `HinweisLeiste` + `zeigeRueckgaengig()` | – | „… gelöscht – Rückgängig“. Löschen geschieht sofort; statt einer Rückfrage gibt es einige Sekunden zum Zurückholen. Rückfragen nur noch, wo nichts zurückzuholen ist (z. B. Sicherung ersetzen). |

## Kopfzeilen und Aktionen

- Jede Ansicht beginnt mit `SeitenKopf`. Die Aktionen rutschen auf schmalen Bildschirmen in eine
  eigene Zeile – nie mehr als drei Knöpfe; Seltenes (Export, Import, Statistik) gehört in einen
  „⋯“-Knopf mit Dialog.
- Symbol-Knöpfe brauchen immer `aria-label` (bei `IconKnopf` Pflicht) und auf der Karte zusätzlich `title`.
- Hinweise und Erinnerungen werden zusammengefasst (eine Karte „N Hinweise“), nicht gestapelt.

## Ausnahmen (bewusst eigener Aufbau)

- **Behörden-Check:** Vollbild zum Vorzeigen bei einer Kontrolle; QR-Code immer auf Weiß.
- **PIN-Sperre beim Entsperren:** `Dialog` mit `schliessbar={false}` vor deckendem Hintergrund.
- **Bestätigungsdialog** (`DialogHost`): kompakter Alert über allen Dialogen (z-[90]).
- **Bild-Vollansicht**, **Flug-Assistent** und **Fehlerseite**: Vollbild.
- **Notfall-Leitfaden**: die eine bewusst laute rote Fläche der App.
- **Diagramme**: Farben über CSS-Variablen (`var(--color-brand-blue)`), damit sie den Dunkelmodus mitmachen; Achsentext mindestens 11 px.

## Prüfen

`npm run e2e` misst den Kontrast aller Ansichten und wichtigen Dialoge in hell und dunkel
(Grenze 3,8 : 1). Neue Dialoge dort in `e2e/kontrast.spec.ts` ergänzen.
