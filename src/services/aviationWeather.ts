// Luftfahrtwetter (METAR/TAF) von aviationweather.gov (NOAA).
//
// Zwei Besonderheiten der Quelle, beide am 2026-07-23 verifiziert:
//  - Sie antwortet nur mit gesetztem User-Agent.
//  - Sie sendet KEINE CORS-Header. Im Browser läuft der Aufruf deshalb über
//    den eigenen Proxy (/api/aviation), in der Android-App dagegen direkt,
//    weil CapacitorHttp fetch nativ ausführt und CORS dort nicht greift.
//
// Die Auswertung (nächste Station, Einheiten, Bewertung) ist rein und testbar;
// nur das Holen der Daten ist Netzwerk.

import { Capacitor } from '@capacitor/core';
import { distanzMeter } from './flightTrack';

export interface MetarStation {
  icaoId: string;
  name: string;
  lat: number;
  lon: number;
  /** Temperatur °C */
  temp: number | null;
  /** Taupunkt °C */
  dewp: number | null;
  /** Windrichtung in Grad */
  wdir: number | null;
  /** Windgeschwindigkeit in Knoten */
  wspd: number | null;
  /** Sichtweite als Rohtext (z.B. "6+") */
  visib: string | null;
  /** Luftdruck QNH in hPa */
  altim: number | null;
  /** VFR | MVFR | IFR | LIFR */
  fltCat: string | null;
  /** Rohmeldung */
  rawOb: string;
  obsTime: number | null;
  /** Entfernung zum Suchpunkt in km — von uns berechnet. */
  entfernungKm?: number;
}

export interface TafMeldung {
  icaoId: string;
  rawTAF: string;
  issueTime: string | null;
}

/** Basis-URL: nativ direkt (CapacitorHttp umgeht CORS), im Web über den Proxy. */
export function basisUrl(): string {
  return Capacitor.isNativePlatform()
    ? 'https://aviationweather.gov/api/data'
    : '/api/aviation';
}

/** Umschließendes Rechteck um einen Punkt, grob in Kilometern.
 *  Reihenfolge wie die API sie erwartet: minLat,minLon,maxLat,maxLon. */
export function bboxUm(lat: number, lon: number, radiusKm = 60): string {
  const dLat = radiusKm / 111;
  // Längengrade rücken zu den Polen hin zusammen.
  const dLon = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${r(lat - dLat)},${r(lon - dLon)},${r(lat + dLat)},${r(lon + dLon)}`;
}

/** Station mit der kleinsten Entfernung zum Punkt (inkl. gesetzter entfernungKm). */
export function naechsteStation(
  stationen: MetarStation[],
  lat: number,
  lon: number
): MetarStation | null {
  if (stationen.length === 0) return null;
  const mitAbstand = stationen
    .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map(s => ({ ...s, entfernungKm: Math.round(distanzMeter(lat, lon, s.lat, s.lon) / 100) / 10 }));
  if (mitAbstand.length === 0) return null;
  return mitAbstand.reduce((a, b) => (b.entfernungKm! < a.entfernungKm! ? b : a));
}

export type SichtLage = 'gut' | 'eingeschraenkt' | 'schlecht' | 'unbekannt';

/** Übersetzt die Flugwetter-Kategorie in eine Einschätzung für Drohnenflug.
 *  VFR = Sichtflugbedingungen; alles darunter heißt schlechte Sicht/tiefe Wolken. */
export function bewerteFltCat(fltCat: string | null): { lage: SichtLage; text: string } {
  switch ((fltCat || '').toUpperCase()) {
    case 'VFR':
      return { lage: 'gut', text: 'Sichtflugbedingungen (VFR) — Sicht und Wolkenuntergrenze unkritisch.' };
    case 'MVFR':
      return { lage: 'eingeschraenkt', text: 'Eingeschränkte Sichtflugbedingungen (MVFR) — Sicht oder Wolken schon knapp.' };
    case 'IFR':
      return { lage: 'schlecht', text: 'Instrumentenflugbedingungen (IFR) — schlechte Sicht oder tiefe Wolken.' };
    case 'LIFR':
      return { lage: 'schlecht', text: 'Sehr schlechte Bedingungen (LIFR) — für Drohnenflug ungeeignet.' };
    default:
      return { lage: 'unbekannt', text: 'Keine Kategorie gemeldet.' };
  }
}

/** Knoten in km/h. */
export function knotenInKmh(kt: number): number {
  return Math.round(kt * 1.852);
}

function zuZahl(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Rohantwort der API in unsere Form bringen. */
export function zuStation(roh: any): MetarStation {
  return {
    icaoId: String(roh?.icaoId ?? ''),
    name: String(roh?.name ?? ''),
    lat: zuZahl(roh?.lat) ?? NaN,
    lon: zuZahl(roh?.lon) ?? NaN,
    temp: zuZahl(roh?.temp),
    dewp: zuZahl(roh?.dewp),
    wdir: zuZahl(roh?.wdir),
    wspd: zuZahl(roh?.wspd),
    visib: roh?.visib != null ? String(roh.visib) : null,
    altim: zuZahl(roh?.altim),
    fltCat: roh?.fltCat != null ? String(roh.fltCat) : null,
    rawOb: String(roh?.rawOb ?? ''),
    obsTime: zuZahl(roh?.obsTime),
  };
}

/** Nächstgelegene METAR-Station zu einem Punkt holen. */
export async function holeMetar(lat: number, lon: number): Promise<MetarStation | null> {
  const url = `${basisUrl()}/metar?format=json&bbox=${encodeURIComponent(bboxUm(lat, lon))}`;
  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error(`METAR: HTTP ${antwort.status}`);
  const daten = await antwort.json();
  if (!Array.isArray(daten)) return null;
  return naechsteStation(daten.map(zuStation), lat, lon);
}

/** TAF (Vorhersage) für eine Station. */
export async function holeTaf(icaoId: string): Promise<TafMeldung | null> {
  const url = `${basisUrl()}/taf?format=json&ids=${encodeURIComponent(icaoId)}`;
  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error(`TAF: HTTP ${antwort.status}`);
  const daten = await antwort.json();
  const erste = Array.isArray(daten) ? daten[0] : null;
  if (!erste) return null;
  return {
    icaoId: String(erste.icaoId ?? icaoId),
    rawTAF: String(erste.rawTAF ?? ''),
    issueTime: erste.issueTime ? String(erste.issueTime) : null,
  };
}
