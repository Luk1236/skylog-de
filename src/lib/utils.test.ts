import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lokalesDatum } from './utils';

describe('lokalesDatum', () => {
  // Deutsche Zeitzone erzwingen, damit der Test auch auf UTC-Rechnern (CI) etwas aussagt.
  const tzVorher = process.env.TZ;
  beforeAll(() => { process.env.TZ = 'Europe/Berlin'; });
  afterAll(() => { process.env.TZ = tzVorher; });

  it('liefert um 00:30 Ortszeit im Sommer den heutigen Tag, nicht den UTC-Vortag', () => {
    const halbEins = new Date('2026-07-14T22:30:00Z'); // 15.07.2026, 00:30 MESZ
    expect(halbEins.toISOString().split('T')[0]).toBe('2026-07-14');
    expect(lokalesDatum(halbEins)).toBe('2026-07-15');
  });

  it('liefert um 00:30 Ortszeit im Winter den heutigen Tag', () => {
    expect(lokalesDatum(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15'); // 00:30 MEZ
  });

  it('bleibt kurz vor Mitternacht beim selben Tag', () => {
    expect(lokalesDatum(new Date('2026-07-15T21:59:00Z'))).toBe('2026-07-15'); // 23:59 MESZ
  });

  it('füllt Monat und Tag mit führender Null auf', () => {
    expect(lokalesDatum(new Date(2026, 2, 5, 12))).toBe('2026-03-05');
  });

  it('nimmt auch Millisekunden an', () => {
    expect(lokalesDatum(new Date(2026, 11, 31, 0, 30).getTime())).toBe('2026-12-31');
  });

  it('nimmt ohne Argument das aktuelle Datum', () => {
    expect(lokalesDatum()).toBe(lokalesDatum(new Date()));
  });
});
