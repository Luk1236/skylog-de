import { describe, it, expect } from 'vitest';
import { minutesUntilSunset } from './weather';

describe('minutesUntilSunset', () => {
  const jetzt = new Date('2026-07-19T19:00:00Z');

  it('rechnet die verbleibenden Minuten aus', () => {
    expect(minutesUntilSunset('2026-07-19T20:30:00Z', jetzt)).toBe(90);
  });

  it('liefert null, wenn die Sonne schon unter ist', () => {
    expect(minutesUntilSunset('2026-07-19T18:00:00Z', jetzt)).toBeNull();
  });

  it('liefert null, wenn die API keine Zeit geliefert hat', () => {
    expect(minutesUntilSunset(null, jetzt)).toBeNull();
  });

  it('liefert null bei unbrauchbarem Zeitstempel statt NaN', () => {
    expect(minutesUntilSunset('kaputt', jetzt)).toBeNull();
  });
});
