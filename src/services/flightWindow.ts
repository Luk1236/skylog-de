// Flugfenster: bewertet die Stundenprognose danach, wie gut sich die jeweilige
// Stunde zum Fliegen eignet. Reine Berechnung aus Wind/Böen/Wetterzustand
// gegen die Windgrenze der Drohne — kein Netz.
//
// Grundgedanke: Bindend ist der stärkste Wert aus Bodenwind, Wind auf 120 m und
// Böen. Niederschlag/Gewitter/Nebel sind unabhängig davon ein Ausschluss.

import type { ForecastHour } from './weather';

export type FensterBewertung = 'gut' | 'grenzwertig' | 'schlecht' | 'nacht';

export interface Flugfenster {
  time: string;
  bewertung: FensterBewertung;
  /** Kurzbegründung für die Anzeige. */
  grund: string;
  /** Der für die Bewertung maßgebliche Windwert (km/h). */
  maxWindKmh: number;
}

/** Standard-Windgrenze in km/h, wenn die Drohne keine eigene hat. */
export const STANDARD_WIND_LIMIT = 28;

const SCHLECHT_WETTER = ['Regen', 'Schnee', 'Gewitter', 'Neblig'];

/** Stundenzahl aus "HH:MM" ziehen. */
function stunde(time: string): number | null {
  const m = time.match(/^(\d{1,2}):/);
  return m ? Number(m[1]) : null;
}

/** Eine einzelne Prognosestunde bewerten. */
export function bewerteStunde(
  h: ForecastHour,
  windLimitKmh: number,
  sonnenuntergangStunde?: number | null,
): Flugfenster {
  const maxWindKmh = Math.round(Math.max(h.windSpeed, h.windSpeed120, h.windGusts));

  const hn = stunde(h.time);
  if (sonnenuntergangStunde != null && hn != null && hn >= sonnenuntergangStunde) {
    return { time: h.time, bewertung: 'nacht', grund: 'Nach Sonnenuntergang', maxWindKmh };
  }

  if (SCHLECHT_WETTER.includes(h.condition)) {
    return { time: h.time, bewertung: 'schlecht', grund: h.condition, maxWindKmh };
  }

  if (maxWindKmh >= windLimitKmh) {
    return { time: h.time, bewertung: 'schlecht', grund: `Wind/Böen ${maxWindKmh} km/h`, maxWindKmh };
  }
  if (maxWindKmh >= windLimitKmh * 0.7) {
    return { time: h.time, bewertung: 'grenzwertig', grund: `Wind/Böen ${maxWindKmh} km/h`, maxWindKmh };
  }
  return { time: h.time, bewertung: 'gut', grund: `Wind/Böen ${maxWindKmh} km/h`, maxWindKmh };
}

/** Die ganze Prognose bewerten. */
export function bewerteFlugfenster(
  stunden: ForecastHour[],
  windLimitKmh: number = STANDARD_WIND_LIMIT,
  sonnenuntergangStunde?: number | null,
): Flugfenster[] {
  const limit = windLimitKmh > 0 ? windLimitKmh : STANDARD_WIND_LIMIT;
  return stunden.map(h => bewerteStunde(h, limit, sonnenuntergangStunde));
}

/** Erste gut geeignete Stunde, sonst die erste grenzwertige, sonst null. */
export function besteStunde(fenster: Flugfenster[]): Flugfenster | null {
  return fenster.find(f => f.bewertung === 'gut')
    ?? fenster.find(f => f.bewertung === 'grenzwertig')
    ?? null;
}

/** Sonnenuntergangs-Stunde aus einem ISO-Zeitstempel, für den Nacht-Check. */
export function sonnenuntergangStunde(sonnenuntergang: string | null): number | null {
  if (!sonnenuntergang) return null;
  const d = new Date(sonnenuntergang);
  return Number.isFinite(d.getTime()) ? d.getHours() : null;
}
