import { describe, expect, it } from 'vitest';
import { flugAusFormular, zwecke } from './neuerFlug';

const STANDORT: [number, number] = [49.87, 8.65];

describe('flugAusFormular', () => {
  it('baut aus vollständigen Eingaben einen Flug', () => {
    const e = flugAusFormular(
      { droneId: 'd1', batteryId: 'a1', date: '2026-10-20', duration: 25, locationName: 'Griesheim', purpose: 'Training', coPilotName: 'Kim', isNightFlight: true },
      STANDORT, 'Unbekannter Ort', 1234, 'f1',
    );
    expect(e).toEqual({
      flug: {
        id: 'f1', droneId: 'd1', batteryId: 'a1', date: '2026-10-20', startTime: '', endTime: '', duration: 25,
        location: '', locationName: 'Griesheim', coordinates: STANDORT, purpose: 'Training', coPilotName: 'Kim',
        isNightFlight: true, notes: '', createdAt: 1234,
      },
    });
  });

  it('füllt fehlenden Ort und Zweck sinnvoll auf', () => {
    const e = flugAusFormular({ droneId: 'd1', date: '2026-10-20', duration: 5 }, STANDORT, 'Unbekannter Ort');
    expect('flug' in e && e.flug.locationName).toBe('Unbekannter Ort');
    expect('flug' in e && e.flug.purpose).toBe('Hobby');
    expect('flug' in e && e.flug.coPilotName).toBeUndefined();
  });

  it('verlangt Drohne und Datum', () => {
    expect(flugAusFormular({ date: '2026-10-20', duration: 5 }, STANDORT, '')).toEqual({ fehler: 'pflichtfelder' });
    expect(flugAusFormular({ droneId: 'd1', duration: 5 }, STANDORT, '')).toEqual({ fehler: 'pflichtfelder' });
  });

  it('verlangt mindestens eine Minute Flugdauer', () => {
    expect(flugAusFormular({ droneId: 'd1', date: '2026-10-20' }, STANDORT, '')).toEqual({ fehler: 'dauer' });
    expect(flugAusFormular({ droneId: 'd1', date: '2026-10-20', duration: 0 }, STANDORT, '')).toEqual({ fehler: 'dauer' });
  });
});

describe('zwecke', () => {
  it('liefert alle fünf Zwecke in der gewählten Sprache', () => {
    const en = zwecke((_de, en) => en);
    expect(en.map(z => z.wert)).toEqual(['Hobby', 'Gewerblich', 'Inspektion', 'Kamerafahrt', 'Training']);
    expect(en[1].label).toBe('Commercial');
  });
});
