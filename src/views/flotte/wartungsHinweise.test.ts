import { describe, expect, it } from 'vitest';
import { drohnenStatistik, wartungsHinweise, type DrohnenStatistik } from './wartungsHinweise';
import type { Flight, MaintenanceRecord } from '../../services/db';

const TAG = 24 * 60 * 60 * 1000;
const JETZT = Date.UTC(2026, 9, 21);
const de = (d: string) => d;

const flug = (createdAt: number, duration = 30) => ({ createdAt, duration }) as Flight;
const wartung = (type: MaintenanceRecord['type'], createdAt: number, hoursAtMaintenance = 0) =>
  ({ type, createdAt, hoursAtMaintenance }) as MaintenanceRecord;

/** Alle Wartungen frisch erledigt - als Ausgangspunkt. */
function frisch(over: Partial<DrohnenStatistik> = {}): DrohnenStatistik {
  const t = JETZT - TAG;
  return {
    hours: 1, flights: 2,
    lastMaint: { Firmware: t, Propeller: t, Motor: t, Sensor: t, General: t },
    lastMaintHours: { Propeller: 1, Motor: 1 },
    flightsSinceMaint: { Propeller: 0, Motor: 0 },
    ...over,
  };
}

describe('drohnenStatistik', () => {
  it('zählt Stunden, Flüge und Flüge seit der letzten Wartung je Typ', () => {
    const fluege = [flug(JETZT - 10 * TAG, 60), flug(JETZT - 5 * TAG, 30), flug(JETZT - TAG, 90)];
    const s = drohnenStatistik(fluege, [wartung('Motor', JETZT - 20 * TAG), wartung('Motor', JETZT - 7 * TAG, 1)]);
    expect(s.hours).toBe(3);
    expect(s.flights).toBe(3);
    expect(s.lastMaint.Motor).toBe(JETZT - 7 * TAG);
    expect(s.lastMaintHours.Motor).toBe(1);
    expect(s.flightsSinceMaint.Motor).toBe(2);
  });
});

describe('wartungsHinweise', () => {
  it('schweigt, wenn alles frisch gewartet ist', () => {
    expect(wartungsHinweise(frisch(), de, JETZT)).toEqual([]);
  });

  it('meldet bei einer neuen Drohne Firmware, Sensoren und Jahresservice', () => {
    const typen = wartungsHinweise(drohnenStatistik([], []), de, JETZT).map(h => h.type);
    expect(typen).toEqual(['Firmware', 'Sensor', 'General']);
  });

  it('meldet Propeller nach 10 Flugstunden oder 50 Flügen', () => {
    expect(wartungsHinweise(frisch({ hours: 12, lastMaintHours: { Propeller: 1, Motor: 11 } }), de, JETZT).map(h => h.type)).toEqual(['Propeller']);
    const nachFluegen = wartungsHinweise(frisch({ flightsSinceMaint: { Propeller: 50, Motor: 0 } }), de, JETZT);
    expect(nachFluegen).toHaveLength(1);
    expect(nachFluegen[0].reason).toContain('50 Flüge');
  });

  it('meldet Motoren nach 25 Flugstunden oder 100 Flügen', () => {
    expect(wartungsHinweise(frisch({ hours: 30, lastMaintHours: { Propeller: 29, Motor: 1 } }), de, JETZT).map(h => h.type)).toEqual(['Motor']);
    expect(wartungsHinweise(frisch({ flightsSinceMaint: { Propeller: 0, Motor: 100 } }), de, JETZT).map(h => h.type)).toEqual(['Motor']);
  });

  it('meldet abgelaufene Zeitintervalle', () => {
    const alt = frisch();
    alt.lastMaint = { ...alt.lastMaint, Firmware: JETZT - 91 * TAG, Sensor: JETZT - 181 * TAG, General: JETZT - 366 * TAG };
    expect(wartungsHinweise(alt, de, JETZT).map(h => h.type)).toEqual(['Firmware', 'Sensor', 'General']);
  });

  it('liefert ohne Statistik nichts und übersetzt sonst', () => {
    expect(wartungsHinweise(undefined, de, JETZT)).toEqual([]);
    const en = (_d: string, e: string) => e;
    expect(wartungsHinweise(drohnenStatistik([], []), en, JETZT)[0].reason).toBe('Update due');
  });
});
