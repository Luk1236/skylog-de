import { describe, it, expect } from 'vitest';
import { istGueltigerOrt } from './geo';

describe('istGueltigerOrt', () => {
  it('akzeptiert echte Koordinaten', () => {
    expect(istGueltigerOrt([52.52, 13.4])).toBe(true);
  });

  it('lehnt Null Island ab (fehlende Import-Koordinaten)', () => {
    expect(istGueltigerOrt([0, 0])).toBe(false);
  });

  it('lehnt fehlende und unendliche Werte ab', () => {
    expect(istGueltigerOrt(undefined)).toBe(false);
    expect(istGueltigerOrt(null)).toBe(false);
    expect(istGueltigerOrt([NaN, 13.4])).toBe(false);
    expect(istGueltigerOrt([52.52, Infinity])).toBe(false);
  });
});
