// Flug-Track: liest eine detaillierte Telemetrie-CSV (z.B. Airdata-Detail-
// export, eine Zeile pro Messpunkt) in eine Zeitreihe und berechnet daraus
// Kennzahlen. Getrennt vom Summen-Import (flightImport.ts), weil das eine
// völlig andere Datenform ist: dort eine Zeile = ein Flug, hier viele Zeilen
// = ein Flug.

import type { TrackPoint } from './db';
import { parseCsv, leseZahl, inMeter } from './flightImport';

type Spur = 'zeit' | 'breite' | 'laenge' | 'hoehe' | 'speed' | 'akku';

const SYN: Record<Spur, string[]> = {
  zeit:   ['time', 'timemilliseconds', 'timems', 'zeit', 'elapsed', 'flighttime', 'seconds', 'timestamp'],
  breite: ['latitude', 'lat', 'breite', 'breitengrad'],
  laenge: ['longitude', 'lon', 'lng', 'laenge', 'langengrad'],
  hoehe:  ['heightabovetakeoff', 'height', 'altitude', 'hoehe', 'relativealtitude', 'altitudefeet'],
  speed:  ['speed', 'geschwindigkeit', 'horizontalspeed', 'hspeed', 'groundspeed'],
  akku:   ['batterypercent', 'battery', 'akku', 'batterylevel', 'remainingbattery'],
};

function norm(kopf: string): string {
  return kopf.toLowerCase().replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/[^a-z0-9]/g, '');
}

function einheit(kopf: string): string | undefined {
  const m = kopf.match(/[([]\s*([a-zA-Z/]+)\s*[)\]]/);
  return m ? m[1].toLowerCase() : undefined;
}

// Speed in km/h bringen — die Diagramm-Einheit.
export function inKmh(wert: number, e?: string): number {
  switch (e) {
    case 'mph':               return wert * 1.609344;
    case 'm/s': case 'ms':    return wert * 3.6;
    case 'kmh': case 'km/h':  return wert;
    default:                  return wert; // unbekannt: unverändert
  }
}

// Meter zwischen zwei Koordinaten (Haversine).
export function distanzMeter(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

interface Zuordnung { spalte: Partial<Record<Spur, number>>; einheit: Partial<Record<Spur, string>>; }

function ordne(kopf: string[]): Zuordnung {
  const spalte: Partial<Record<Spur, number>> = {};
  const einh: Partial<Record<Spur, string>> = {};
  const belegt = new Set<number>();
  // Reihenfolge: eindeutige Felder zuerst, 'zeit' zuletzt (teilt Synonyme mit anderen)
  (['breite', 'laenge', 'hoehe', 'speed', 'akku', 'zeit'] as Spur[]).forEach(s => {
    for (let i = 0; i < kopf.length; i++) {
      if (belegt.has(i)) continue;
      if (SYN[s].includes(norm(kopf[i]))) {
        spalte[s] = i;
        einh[s] = einheit(kopf[i]);
        belegt.add(i);
        break;
      }
    }
  });
  return { spalte, einheit: einh };
}

export interface TrackParseErgebnis {
  track: TrackPoint[];
  fehler: string[];
}

export function parseTrackCsv(text: string): TrackParseErgebnis {
  const zeilen = parseCsv(text);
  if (zeilen.length < 2) return { track: [], fehler: ['Keine auswertbaren Datenzeilen.'] };

  const [kopf, ...daten] = zeilen;
  const z = ordne(kopf);
  const fehler: string[] = [];
  if (z.spalte.breite === undefined || z.spalte.laenge === undefined) {
    return { track: [], fehler: ['Keine Koordinatenspalten (Latitude/Longitude) erkannt.'] };
  }

  const hole = (r: string[], s: Spur) => (z.spalte[s] !== undefined ? r[z.spalte[s]!] : '');

  // Zeitbasis bestimmen: bevorzugt die Zeitspalte (ms oder s), sonst Zeilenindex.
  const zeitEinheit = z.einheit.zeit;
  const istMs = zeitEinheit === 'millisecond' || zeitEinheit === 'milliseconds' || zeitEinheit === 'ms';
  let t0: number | null = null;

  const track: TrackPoint[] = [];
  daten.forEach((r, i) => {
    const lat = leseZahl(hole(r, 'breite'));
    const lon = leseZahl(hole(r, 'laenge'));
    if (lat === null || lon === null) return; // Punkt ohne Position überspringen

    let t: number;
    const zRoh = leseZahl(hole(r, 'zeit'));
    if (z.spalte.zeit !== undefined && zRoh !== null) {
      if (t0 === null) t0 = zRoh;
      t = istMs ? (zRoh - t0) / 1000 : zRoh - t0;
    } else {
      t = i; // Fallback: eine Sekunde pro Zeile
    }

    const punkt: TrackPoint = { t: Math.round(t), lat, lon };
    const h = leseZahl(hole(r, 'hoehe'));
    if (h !== null) punkt.alt = Math.round(inMeter(h, z.einheit.hoehe) * 10) / 10;
    const sp = leseZahl(hole(r, 'speed'));
    if (sp !== null) punkt.speed = Math.round(inKmh(sp, z.einheit.speed) * 10) / 10;
    const b = leseZahl(hole(r, 'akku'));
    if (b !== null) punkt.battery = Math.round(b);

    track.push(punkt);
  });

  if (track.length === 0) fehler.push('Keine gültigen Punkte mit Koordinaten gefunden.');
  return { track, fehler };
}

export interface TrackStats {
  punkte: number;
  dauerS: number;
  maxHoeheM: number | null;
  maxSpeedKmh: number | null;
  distanzM: number;      // aufsummierte Strecke
  maxDistanzM: number;   // größte Entfernung vom Startpunkt
}

export function berechneTrackStats(track: TrackPoint[]): TrackStats {
  if (track.length === 0) {
    return { punkte: 0, dauerS: 0, maxHoeheM: null, maxSpeedKmh: null, distanzM: 0, maxDistanzM: 0 };
  }
  const start = track[0];
  let distanz = 0;
  let maxDist = 0;
  let maxH: number | null = null;
  let maxS: number | null = null;

  for (let i = 0; i < track.length; i++) {
    const p = track[i];
    if (typeof p.alt === 'number') maxH = maxH === null ? p.alt : Math.max(maxH, p.alt);
    if (typeof p.speed === 'number') maxS = maxS === null ? p.speed : Math.max(maxS, p.speed);
    maxDist = Math.max(maxDist, distanzMeter(start.lat, start.lon, p.lat, p.lon));
    if (i > 0) distanz += distanzMeter(track[i - 1].lat, track[i - 1].lon, p.lat, p.lon);
  }

  return {
    punkte: track.length,
    dauerS: Math.max(0, track[track.length - 1].t - start.t),
    maxHoeheM: maxH,
    maxSpeedKmh: maxS,
    distanzM: Math.round(distanz),
    maxDistanzM: Math.round(maxDist),
  };
}
