import { describe, it, expect } from 'vitest';
import {
  gesamtStrecke, maxEntfernungVomStart, geschaetzteFlugzeitS, formatZeit, formatStrecke,
  wegpunktHinzufuegen, wegpunktEntfernen, wegpunktVerschieben, bewertePlan,
  VLOS_GRENZE_M,
} from './flightPlan';
import type { Wegpunkt } from './db';

// ~111 m je 0,001° Breite
const A: Wegpunkt = { lat: 49.870, lon: 8.650 };
const B: Wegpunkt = { lat: 49.871, lon: 8.650 };
const C: Wegpunkt = { lat: 49.872, lon: 8.650 };

describe('gesamtStrecke', () => {
  it('summiert die Abschnitte', () => {
    expect(gesamtStrecke([A, B, C])).toBeCloseTo(222, -1);
  });
  it('ist 0 bei weniger als zwei Punkten', () => {
    expect(gesamtStrecke([])).toBe(0);
    expect(gesamtStrecke([A])).toBe(0);
  });
});

describe('maxEntfernungVomStart', () => {
  it('nimmt den entferntesten Punkt, nicht den letzten', () => {
    const zurueck: Wegpunkt = { lat: 49.8705, lon: 8.650 };
    expect(maxEntfernungVomStart([A, C, zurueck])).toBeCloseTo(222, -1);
  });
  it('ist 0 ohne Punkte', () => {
    expect(maxEntfernungVomStart([])).toBe(0);
  });
});

describe('geschaetzteFlugzeitS', () => {
  it('rechnet Strecke durch Geschwindigkeit', () => {
    // 1000 m bei 36 km/h (=10 m/s) -> 100 s
    expect(geschaetzteFlugzeitS(1000, 36)).toBe(100);
  });
  it('ist 0 bei unsinniger Geschwindigkeit', () => {
    expect(geschaetzteFlugzeitS(1000, 0)).toBe(0);
  });
});

describe('Formatierung', () => {
  it('formatiert Zeit als m:ss', () => {
    expect(formatZeit(185)).toBe('3:05');
    expect(formatZeit(0)).toBe('0:00');
  });
  it('formatiert Meter und Kilometer', () => {
    expect(formatStrecke(450)).toBe('450 m');
    expect(formatStrecke(1234)).toBe('1,2 km');
  });
});

describe('Wegpunkt-Operationen', () => {
  it('hängt an', () => {
    expect(wegpunktHinzufuegen([A], B)).toHaveLength(2);
  });
  it('entfernt nach Index', () => {
    expect(wegpunktEntfernen([A, B, C], 1)).toEqual([A, C]);
  });
  it('ignoriert einen ungültigen Index', () => {
    expect(wegpunktEntfernen([A], 5)).toEqual([A]);
  });
  it('verschiebt hoch und runter', () => {
    expect(wegpunktVerschieben([A, B, C], 1, -1)).toEqual([B, A, C]);
    expect(wegpunktVerschieben([A, B, C], 1, 1)).toEqual([A, C, B]);
  });
  it('lässt Randfälle unverändert', () => {
    expect(wegpunktVerschieben([A, B], 0, -1)).toEqual([A, B]);
    expect(wegpunktVerschieben([A, B], 1, 1)).toEqual([A, B]);
  });
});

describe('bewertePlan', () => {
  it('mahnt zu wenige Wegpunkte an', () => {
    expect(bewertePlan([A]).hinweise.join(' ')).toMatch(/Mindestens zwei/);
  });

  it('meldet keine VLOS-Warnung bei kurzer Route', () => {
    const b = bewertePlan([A, B]);
    expect(b.ueberVlos).toBe(false);
    expect(b.hinweise.join(' ')).not.toMatch(/VLOS/);
  });

  it('warnt, wenn ein Punkt über der Sichtweiten-Grenze liegt', () => {
    const weit: Wegpunkt = { lat: A.lat + 0.01, lon: A.lon }; // ~1,1 km
    const b = bewertePlan([A, weit]);
    expect(b.maxEntfernungM).toBeGreaterThan(VLOS_GRENZE_M);
    expect(b.ueberVlos).toBe(true);
    expect(b.hinweise.join(' ')).toMatch(/VLOS/);
  });

  it('warnt, wenn die Flugzeit die Akkulaufzeit ausreizt', () => {
    const weit: Wegpunkt = { lat: A.lat + 0.05, lon: A.lon }; // ~5,5 km
    const b = bewertePlan([A, weit], 30, 10); // ~11 min bei 10 min Akku
    expect(b.hinweise.join(' ')).toMatch(/Akku/);
  });

  it('schweigt zum Akku, wenn reichlich Reserve da ist', () => {
    const b = bewertePlan([A, B], 30, 30);
    expect(b.hinweise.join(' ')).not.toMatch(/Akku/);
  });
});
