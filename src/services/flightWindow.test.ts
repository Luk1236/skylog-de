import { describe, it, expect } from 'vitest';
import { bewerteFlugfenster, besteStunde, sonnenuntergangStunde } from './flightWindow';
import type { ForecastHour } from './weather';

function h(over: Partial<ForecastHour>): ForecastHour {
  return { time: '12:00', temp: 18, windSpeed: 10, windSpeed120: 12, windGusts: 14, condition: 'Klar', ...over };
}

describe('bewerteFlugfenster', () => {
  it('gut bei wenig Wind, grenzwertig nahe Limit, schlecht ab Limit', () => {
    const f = bewerteFlugfenster([
      h({ time: '10:00', windSpeed: 8, windSpeed120: 10, windGusts: 12 }), // max 12 < 0.7*28=19.6 -> gut
      h({ time: '11:00', windSpeed: 15, windSpeed120: 20, windGusts: 22 }), // 22 >=19.6, <28 -> grenzwertig
      h({ time: '12:00', windSpeed: 20, windSpeed120: 28, windGusts: 30 }), // 30 >=28 -> schlecht
    ], 28);
    expect(f[0].bewertung).toBe('gut');
    expect(f[1].bewertung).toBe('grenzwertig');
    expect(f[2].bewertung).toBe('schlecht');
  });

  it('bindend ist der stärkste Windwert (auch 120 m / Böen)', () => {
    const f = bewerteFlugfenster([h({ windSpeed: 5, windSpeed120: 30, windGusts: 8 })], 28);
    expect(f[0].bewertung).toBe('schlecht');
    expect(f[0].maxWindKmh).toBe(30);
  });

  it('Niederschlag/Gewitter ist unabhängig vom Wind schlecht', () => {
    const f = bewerteFlugfenster([h({ windSpeed: 2, windSpeed120: 3, windGusts: 4, condition: 'Gewitter' })], 28);
    expect(f[0].bewertung).toBe('schlecht');
    expect(f[0].grund).toBe('Gewitter');
  });

  it('markiert Stunden nach Sonnenuntergang als Nacht', () => {
    const f = bewerteFlugfenster([h({ time: '21:00', windSpeed: 3, windSpeed120: 3, windGusts: 3 })], 28, 20);
    expect(f[0].bewertung).toBe('nacht');
  });

  it('fällt auf Standardlimit zurück, wenn 0 übergeben wird', () => {
    const f = bewerteFlugfenster([h({ windSpeed: 25, windSpeed120: 25, windGusts: 27 })], 0);
    // 27 < 28 (Standard), >=19.6 -> grenzwertig
    expect(f[0].bewertung).toBe('grenzwertig');
  });
});

describe('besteStunde', () => {
  it('bevorzugt die erste gute, sonst grenzwertige Stunde', () => {
    const f = bewerteFlugfenster([
      h({ time: '10:00', windSpeed: 20, windSpeed120: 25, windGusts: 27 }), // grenzwertig
      h({ time: '11:00', windSpeed: 5, windSpeed120: 6, windGusts: 8 }),    // gut
    ], 28);
    expect(besteStunde(f)?.time).toBe('11:00');
  });

  it('gibt null zurück, wenn alles schlecht ist', () => {
    const f = bewerteFlugfenster([h({ condition: 'Regen' })], 28);
    expect(besteStunde(f)).toBeNull();
  });
});

describe('sonnenuntergangStunde', () => {
  it('liest die Stunde aus einem ISO-Zeitstempel', () => {
    expect(sonnenuntergangStunde('2026-08-16T20:45')).toBe(20);
    expect(sonnenuntergangStunde(null)).toBeNull();
  });
});
