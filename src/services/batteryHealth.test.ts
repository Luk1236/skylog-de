import { describe, it, expect } from 'vitest';
import {
  effektiveGesundheit, restZyklen, lebensdauerBewertung, gesundheitsProjektion,
} from './batteryHealth';
import type { Battery, BatteryReading } from './db';

function akku(over: Partial<Battery> = {}): Battery {
  return { id: 'b1', number: '#1', cycles: 0, createdAt: 0, ...over } as Battery;
}

describe('effektiveGesundheit', () => {
  it('nutzt den erfassten Wert, wenn vorhanden', () => {
    expect(effektiveGesundheit(akku({ health: 82 }))).toBe(82);
  });
  it('schätzt aus Zyklen, wenn kein Wert da ist', () => {
    expect(effektiveGesundheit(akku({ cycles: 100 }))).toBe(85); // 100 - 15
  });
  it('fällt geschätzt nicht unter die Austausch-Schwelle', () => {
    expect(effektiveGesundheit(akku({ cycles: 999 }))).toBe(60);
  });
});

describe('restZyklen', () => {
  it('rechnet gegen die Standard-Grenze (200)', () => {
    expect(restZyklen(akku({ cycles: 50 }))).toBe(150);
  });
  it('respektiert eine eigene maxCycles', () => {
    expect(restZyklen(akku({ cycles: 50, maxCycles: 300 }))).toBe(250);
  });
  it('wird nicht negativ', () => {
    expect(restZyklen(akku({ cycles: 500 }))).toBe(0);
  });
});

describe('lebensdauerBewertung', () => {
  it('meldet guten Zustand bei frischem Akku', () => {
    expect(lebensdauerBewertung(akku({ cycles: 10, health: 98 })).level).toBe('gut');
  });
  it('meldet Austausch bei niedriger Gesundheit', () => {
    expect(lebensdauerBewertung(akku({ health: 55 })).level).toBe('austausch');
  });
  it('meldet Austausch, wenn keine Zyklen mehr übrig sind', () => {
    expect(lebensdauerBewertung(akku({ cycles: 200, health: 90 })).level).toBe('austausch');
  });
  it('meldet beobachten im Mittelbereich', () => {
    expect(lebensdauerBewertung(akku({ cycles: 120, health: 72 })).level).toBe('beobachten');
  });
});

describe('gesundheitsProjektion', () => {
  const now = new Date('2026-07-01T00:00:00');

  it('braucht mindestens zwei Messungen', () => {
    const p = gesundheitsProjektion([{ date: '2026-06-01', cycles: 10, health: 95 }], now);
    expect(p.monateBisAustausch).toBeNull();
    expect(p.text).toMatch(/mindestens zwei/);
  });

  it('erkennt einen Verschleißtrend und rechnet hoch', () => {
    // 100% im Jan, 90% im Apr -> ~-3.3%/Monat, von 60% Schwelle noch weit weg
    const h: BatteryReading[] = [
      { date: '2026-01-01', cycles: 10, health: 100 },
      { date: '2026-04-01', cycles: 40, health: 90 },
    ];
    const p = gesundheitsProjektion(h, now);
    expect(p.trendProMonat).toBeLessThan(0);
    expect(p.monateBisAustausch).toBeGreaterThan(0);
    expect(p.text).toMatch(/Austausch-Schwelle/);
  });

  it('meldet stabil, wenn kein Rückgang vorliegt', () => {
    const h: BatteryReading[] = [
      { date: '2026-01-01', cycles: 10, health: 90 },
      { date: '2026-04-01', cycles: 20, health: 91 },
    ];
    const p = gesundheitsProjektion(h, now);
    expect(p.monateBisAustausch).toBeNull();
    expect(p.text).toMatch(/stabil/);
  });

  it('ignoriert Messungen ohne Gesundheitswert', () => {
    const h: BatteryReading[] = [
      { date: '2026-01-01', cycles: 10 },
      { date: '2026-04-01', cycles: 40 },
    ];
    expect(gesundheitsProjektion(h, now).monateBisAustausch).toBeNull();
  });
});
