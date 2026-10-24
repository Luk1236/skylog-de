// DJI-eigener Import: SRT-Videotelemetrie.
//
// DJI schreibt beim Filmen optional eine SRT-Untertiteldatei mit, die pro
// Videobild Zeitstempel, Position und Höhe enthält. Das ist – anders als die
// verschlüsselten DAT/.txt-Flugprotokolle der DJI-Fly-App – ein offenes
// Textformat und damit client-seitig auswertbar.
//
// Aus der Telemetrie wird EIN Flug zusammengefasst (Start, Dauer, Startpunkt,
// max. Höhe, max. Entfernung). Ergebnis ist bewusst dieselbe ImportVorschau
// wie beim CSV-Import, sodass der vorhandene Import-Dialog (Drohnen-Zuordnung,
// Dublettenprüfung, Speichern) unverändert weiterverwendet werden kann.
//
// Zwei SRT-Varianten kommen vor und werden beide gelesen:
//   neu  … [latitude: 48.12] [longitude: 7.98] [rel_alt: 50.1 abs_alt: 250.3]
//   alt  … GPS (7.98,48.12,14) BAROMETER: 50.10   (GPS-Reihenfolge: LON,LAT,Sat)

import type { Flight, TrackPoint } from './db';
import { istDublette, type ImportVorschau, type ImportKandidat } from './flightImport';
import { distanzMeter } from './flightTrack';

export interface SrtProbe {
  /** Zeit in ms seit Epoche (lokale Uhrzeit der Drohne), falls die Datei ein Datum enthält. */
  zeitMs?: number;
  /** Zeit seit dem ersten Block in ms, aus dem SRT-Zeitcode. */
  relativMs: number;
  lat: number;
  lon: number;
  /** Höhe über Start in Metern, falls vorhanden. */
  altM?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Zeitstempel wie "2023-05-01 10:15:30.123", "2020-01-01 10:00:00,000,000"
 *  oder "2017.08.05 14:11:51". Als lokale Wanduhrzeit interpretiert — DJI
 *  schreibt die Zeit ohne Zone. */
function leseZeitstempel(text: string): number | null {
  const m = text.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})[ T](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, bruch] = m;
  const ms = bruch ? Number(bruch.padEnd(3, '0').slice(0, 3)) : 0;
  const t = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Startzeit eines SRT-Blocks in ms seit Beginn des Videos. Der Zeitcode ist
 *  die verlässlichste Zeitachse: Er löst auch dann auf, wenn der absolute
 *  Zeitstempel nur Sekunden enthält oder ganz fehlt (Phantom 4). */
function leseTimecode(block: string): number | null {
  const m = block.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->/);
  if (!m) return null;
  const [, h, mi, s, ms] = m;
  return ((Number(h) * 60 + Number(mi)) * 60 + Number(s)) * 1000 + Number(ms);
}

/** Position aus einem SRT-Block ziehen. Deckt beide Varianten ab. */
function lesePosition(block: string): { lat: number; lon: number } | null {
  // Neue Variante: einzeln benannte Felder. Manche DJI-Modelle schreiben
  // "longtitude" (mit t) – das ist in echten Dateien verbreitet.
  const lat = block.match(/latitude\s*:?\s*(-?\d+(?:\.\d+)?)/i);
  const lon = block.match(/long(?:i|ti)tude\s*:?\s*(-?\d+(?:\.\d+)?)/i);
  if (lat && lon) {
    return { lat: Number(lat[1]), lon: Number(lon[1]) };
  }
  // Alte Variante: GPS (LON, LAT, Satelliten) — Längengrad zuerst!
  const gps = block.match(/GPS\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,/i);
  if (gps) {
    return { lat: Number(gps[2]), lon: Number(gps[1]) };
  }
  return null;
}

/** Höhe über Start aus einem SRT-Block. rel_alt (neu), altitude (Mavic Air 2),
 *  BAROMETER (alt) bzw. H …m (Phantom 4). */
function leseHoehe(block: string): number | undefined {
  const rel = block.match(/rel_alt\s*:?\s*(-?\d+(?:\.\d+)?)/i);
  if (rel) return Number(rel[1]);
  const alt = block.match(/\baltitude\s*:?\s*(-?\d+(?:\.\d+)?)/i);
  if (alt) return Number(alt[1]);
  const baro = block.match(/BAROMETER\s*:?\s*(-?\d+(?:\.\d+)?)/i);
  if (baro) return Number(baro[1]);
  // Phantom/Matrice: Hb (barometrisch) bzw. Hs (Ultraschall).
  const hb = block.match(/\bHb\s*:?\s*(-?\d+(?:\.\d+)?)/i);
  if (hb) return Number(hb[1]);
  const hs = block.match(/\bHs\s*:?\s*(-?\d+(?:\.\d+)?)/i);
  if (hs) return Number(hs[1]);
  const h = block.match(/\bH\s+(-?\d+(?:\.\d+)?)\s*m\b/i);
  if (h) return Number(h[1]);
  return undefined;
}

/** Rohe Telemetrie-Proben aus dem SRT-Text lesen. Blöcke sind durch
 *  Leerzeilen getrennt (SRT-Standard); jeder Block liefert höchstens eine
 *  Probe, und nur wenn eine Position darin steht. */
export function parseSrtProben(text: string): SrtProbe[] {
  const sauber = text.replace(/^\uFEFF/, '');
  const bloecke = sauber.split(/\r?\n\s*\r?\n/);
  const roh: { zeitMs?: number; timecode: number | null; lat: number; lon: number; altM?: number }[] = [];

  for (const block of bloecke) {
    const pos = lesePosition(block);
    if (!pos) continue;
    const zeitMs = leseZeitstempel(block) ?? undefined;
    const timecode = leseTimecode(block);
    if (zeitMs === undefined && timecode === null) continue;
    roh.push({ zeitMs, timecode, lat: pos.lat, lon: pos.lon, altM: leseHoehe(block) });
  }

  const ersteAbsolut = roh.find(p => p.zeitMs !== undefined)?.zeitMs;
  const proben: SrtProbe[] = roh.map(p => ({
    zeitMs: p.zeitMs,
    relativMs: p.timecode ?? (p.zeitMs !== undefined && ersteAbsolut !== undefined ? p.zeitMs - ersteAbsolut : 0),
    lat: p.lat,
    lon: p.lon,
    altM: p.altM,
  }));

  proben.sort((a, b) => a.relativMs - b.relativMs || (a.zeitMs ?? 0) - (b.zeitMs ?? 0));

  // Auf den ersten Block normieren: Der Track beginnt bei 0, auch wenn die
  // SRT-Datei mit 00:00:01 beginnt (z. B. Phantom-4-Dateien).
  const start = proben[0]?.relativMs ?? 0;
  for (const p of proben) p.relativMs -= start;

  return proben;
}

/** Proben in eine Flugaufzeichnung (TrackPoint[]) wandeln. Zeit relativ zum
 *  Start in Sekunden; Geschwindigkeit aus dem Abstand aufeinanderfolgender
 *  Punkte berechnet (SRT liefert sie nicht direkt). So kann die Analyse-Ansicht
 *  Höhen- und Speed-Kurve zeichnen. */
export function probenZuTrack(proben: SrtProbe[]): TrackPoint[] {
  if (proben.length === 0) return [];
  return proben.map((p, i) => {
    let speed: number | undefined;
    if (i > 0) {
      const vor = proben[i - 1];
      const dtSek = (p.relativMs - vor.relativMs) / 1000;
      if (dtSek > 0) {
        const meter = distanzMeter(vor.lat, vor.lon, p.lat, p.lon);
        speed = Math.round((meter / dtSek) * 3.6 * 10) / 10; // m/s -> km/h
      }
    }
    return {
      // 0,1-s-Auflösung: reicht für die Diagramme und hält kurze Clips lesbar.
      t: Math.round(p.relativMs / 100) / 10,
      lat: p.lat,
      lon: p.lon,
      alt: p.altM,
      speed,
    };
  });
}

export interface SrtZusammenfassung {
  datum: string;
  startzeit: string;
  dauerSekunden: number;
  start: [number, number];
  maxHoeheM?: number;
  maxDistanzM: number;
  anzahlProben: number;
}

/** Die Proben zu einem Flug verdichten. null, wenn keine Position oder kein
 *  Datum vorlag. Ohne Datum in der Datei dient fallbackZeitMs (Datei-Zeitstempel
 *  aus dem Import-Dialog) als Bezug. */
export function fasseSrtZusammen(proben: SrtProbe[], fallbackZeitMs?: number): SrtZusammenfassung | null {
  if (proben.length === 0) return null;

  const erste = proben[0];
  const letzte = proben[proben.length - 1];
  const basis = erste.zeitMs ?? fallbackZeitMs;
  if (basis === undefined) return null;
  const d = new Date(basis);

  let maxDistanzM = 0;
  let maxHoeheM: number | undefined;
  for (const p of proben) {
    maxDistanzM = Math.max(maxDistanzM, distanzMeter(erste.lat, erste.lon, p.lat, p.lon));
    if (p.altM !== undefined) maxHoeheM = Math.max(maxHoeheM ?? p.altM, p.altM);
  }

  return {
    datum: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    startzeit: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    dauerSekunden: Math.max(0, Math.round((letzte.relativMs - erste.relativMs) / 1000)),
    start: [erste.lat, erste.lon],
    maxHoeheM: maxHoeheM !== undefined ? Math.round(maxHoeheM) : undefined,
    maxDistanzM: Math.round(maxDistanzM),
    anzahlProben: proben.length,
  };
}

/** SRT-Text in eine ImportVorschau mit genau einem Flug-Kandidaten überführen.
 *  Gleiches Format wie baueVorschau (CSV), damit der Import-Dialog es ohne
 *  Sonderfall verarbeiten kann. */
export function baueVorschauAusSrt(
  srtText: string,
  vorhandeneFluege: Flight[] = [],
  fallbackZeitMs?: number,
): ImportVorschau {
  const proben = parseSrtProben(srtText);

  if (proben.length === 0) {
    return {
      zuordnung: {}, nichtZugeordnet: [], kandidaten: [],
      fehler: ['Keine Telemetrie mit Position gefunden. Ist das eine DJI-SRT-Datei mit GPS-Daten?'],
    };
  }

  const z = fasseSrtZusammen(proben, fallbackZeitMs);
  if (!z) {
    return {
      zuordnung: {}, nichtZugeordnet: [], kandidaten: [],
      fehler: ['Die SRT-Datei enthält kein Datum. Bitte den Flug von Hand eintragen.'],
    };
  }

  const hinweise: string[] = [];
  if (proben[0].zeitMs === undefined) {
    hinweise.push('Kein Datum in der SRT-Datei – Datum und Uhrzeit aus der Datei übernommen, bitte prüfen.');
  }
  if (z.dauerSekunden === 0) {
    hinweise.push('Flugdauer aus den Zeitstempeln nicht bestimmbar — bitte prüfen.');
  }
  if (z.maxHoeheM === undefined) {
    hinweise.push('Keine Höhendaten in der Datei.');
  }

  const flug: Partial<Flight> = {
    date: z.datum,
    startTime: z.startzeit,
    duration: Math.round(z.dauerSekunden / 60),
    coordinates: z.start,
  };

  const kandidat: ImportKandidat = {
    zeile: 1,
    flug,
    hinweise,
    dubletteVon: istDublette(flug, vorhandeneFluege)?.id,
    // SRT nennt kein Modell → der Dialog nutzt die gewählte Ersatzdrohne.
    modellText: undefined,
    maxHoeheM: z.maxHoeheM,
    distanzM: z.maxDistanzM,
    track: probenZuTrack(proben),
  };

  return { zuordnung: {}, nichtZugeordnet: [], kandidaten: [kandidat], fehler: [] };
}

/** Grobe Erkennung, ob ein Datei-Inhalt eine (DJI-)SRT-Datei ist. */
export function istSrt(dateiname: string, inhalt: string): boolean {
  if (/\.srt$/i.test(dateiname)) return true;
  // SRT beginnt mit einer Zählnummer und einer Timecode-Zeile "… --> …".
  return /^\s*\d+\s*\r?\n\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(inhalt);
}
