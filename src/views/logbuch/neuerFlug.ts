import type { Flight } from '../../services/db';

type Tx = (de: string, en: string) => string;

/** Flugzwecke mit Beschriftung in der gewählten Sprache. */
export function zwecke(tx: Tx): { wert: NonNullable<Flight['purpose']>; label: string }[] {
  return [
    { wert: 'Hobby', label: 'Hobby' },
    { wert: 'Gewerblich', label: tx('Gewerblich', 'Commercial') },
    { wert: 'Inspektion', label: tx('Inspektion', 'Inspection') },
    { wert: 'Kamerafahrt', label: tx('Kamerafahrt', 'Camera shot') },
    { wert: 'Training', label: 'Training' },
  ];
}

export type FormularErgebnis =
  | { flug: Flight }
  | { fehler: 'pflichtfelder' | 'dauer' };

/** Formulareingaben in einen Flug verwandeln - oder sagen, was fehlt. */
export function flugAusFormular(
  eingabe: Partial<Flight>,
  standort: [number, number],
  unbekannterOrt: string,
  jetzt: number = Date.now(),
  id: string = crypto.randomUUID(),
): FormularErgebnis {
  if (!eingabe.droneId || !eingabe.date) return { fehler: 'pflichtfelder' };
  if (!eingabe.duration || eingabe.duration <= 0) return { fehler: 'dauer' };
  return {
    flug: {
      id,
      droneId: eingabe.droneId,
      batteryId: eingabe.batteryId,
      date: eingabe.date,
      startTime: eingabe.startTime || '',
      endTime: eingabe.endTime || '',
      duration: eingabe.duration,
      location: '',
      locationName: eingabe.locationName || unbekannterOrt,
      coordinates: standort,
      purpose: eingabe.purpose || 'Hobby',
      coPilotName: eingabe.coPilotName || undefined,
      isNightFlight: !!eingabe.isNightFlight,
      notes: eingabe.notes || '',
      createdAt: jetzt,
    },
  };
}
