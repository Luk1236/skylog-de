// Flugplanung: Wegpunkte setzen, Strecke und Flugzeit abschätzen, Pläne
// benennen und wiederverwenden.
//
// Bewusst OHNE Upload zur Drohne — dafür bräuchte es DJIs Waypoint-Format
// und das native SDK. Der Plan dient der Vorbereitung: Wie weit ist die
// Route, reicht ein Akku, bleibe ich in Sichtweite?
//
// Reine Berechnung, testbar; das Speichern läuft über dbService.

import type { Wegpunkt } from './db';
import { distanzMeter } from './flightTrack';

/** Realistische Reisegeschwindigkeit einer Consumer-Drohne (km/h). */
export const STANDARD_SPEED_KMH = 30;
/** Grobe Sichtweiten-Grenze für VLOS in Metern (Erfahrungswert, kein Gesetz). */
export const VLOS_GRENZE_M = 500;

/** Summe der Strecke entlang der Wegpunkte in Metern. */
export function gesamtStrecke(wegpunkte: Wegpunkt[]): number {
  let summe = 0;
  for (let i = 1; i < wegpunkte.length; i++) {
    summe += distanzMeter(
      wegpunkte[i - 1].lat, wegpunkte[i - 1].lon,
      wegpunkte[i].lat, wegpunkte[i].lon
    );
  }
  return Math.round(summe);
}

/** Größte Entfernung eines Wegpunkts vom Startpunkt (für die VLOS-Frage). */
export function maxEntfernungVomStart(wegpunkte: Wegpunkt[]): number {
  if (wegpunkte.length === 0) return 0;
  const start = wegpunkte[0];
  return Math.round(
    wegpunkte.reduce((max, w) => Math.max(max, distanzMeter(start.lat, start.lon, w.lat, w.lon)), 0)
  );
}

/** Geschätzte reine Flugzeit in Sekunden bei gegebener Reisegeschwindigkeit. */
export function geschaetzteFlugzeitS(streckeM: number, speedKmh = STANDARD_SPEED_KMH): number {
  if (speedKmh <= 0) return 0;
  return Math.round(streckeM / ((speedKmh * 1000) / 3600));
}

/** "3:05" aus Sekunden. */
export function formatZeit(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "1,2 km" oder "450 m". */
export function formatStrecke(meter: number): string {
  if (meter < 1000) return `${Math.round(meter)} m`;
  return `${(meter / 1000).toFixed(1).replace('.', ',')} km`;
}

// --- reine Listenoperationen ---

export function wegpunktHinzufuegen(liste: Wegpunkt[], punkt: Wegpunkt): Wegpunkt[] {
  return [...liste, punkt];
}

export function wegpunktEntfernen(liste: Wegpunkt[], index: number): Wegpunkt[] {
  if (index < 0 || index >= liste.length) return liste;
  return liste.filter((_, i) => i !== index);
}

/** Verschiebt einen Wegpunkt um eine Position (-1 hoch, +1 runter). */
export function wegpunktVerschieben(liste: Wegpunkt[], index: number, richtung: -1 | 1): Wegpunkt[] {
  const ziel = index + richtung;
  if (index < 0 || index >= liste.length || ziel < 0 || ziel >= liste.length) return liste;
  const kopie = [...liste];
  [kopie[index], kopie[ziel]] = [kopie[ziel], kopie[index]];
  return kopie;
}

export interface PlanBewertung {
  streckeM: number;
  flugzeitS: number;
  maxEntfernungM: number;
  /** true, wenn ein Wegpunkt weiter als die VLOS-Grenze entfernt liegt. */
  ueberVlos: boolean;
  hinweise: string[];
}

/** Fasst den Plan zusammen und weist auf Sichtweite und Akkulaufzeit hin. */
export function bewertePlan(
  wegpunkte: Wegpunkt[],
  speedKmh = STANDARD_SPEED_KMH,
  akkuMinuten?: number
): PlanBewertung {
  const streckeM = gesamtStrecke(wegpunkte);
  const flugzeitS = geschaetzteFlugzeitS(streckeM, speedKmh);
  const maxEntfernungM = maxEntfernungVomStart(wegpunkte);
  const ueberVlos = maxEntfernungM > VLOS_GRENZE_M;
  const hinweise: string[] = [];

  if (wegpunkte.length < 2) {
    hinweise.push('Mindestens zwei Wegpunkte setzen, damit eine Route entsteht.');
  }
  if (ueberVlos) {
    hinweise.push(
      `Entferntester Punkt liegt ${formatStrecke(maxEntfernungM)} weg — Sichtverbindung (VLOS) prüfen.`
    );
  }
  if (akkuMinuten !== undefined && akkuMinuten > 0 && flugzeitS > akkuMinuten * 60 * 0.8) {
    hinweise.push(
      `Reine Flugzeit ${formatZeit(flugzeitS)} bei ${akkuMinuten} min Akku — knapp, Reserve einplanen.`
    );
  }

  return { streckeM, flugzeitS, maxEntfernungM, ueberVlos, hinweise };
}
