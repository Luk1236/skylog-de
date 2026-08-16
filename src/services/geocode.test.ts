import { describe, it, expect } from 'vitest';
import { parseKoordinaten, sindGueltigeKoordinaten } from './geocode';

describe('sindGueltigeKoordinaten', () => {
  it('akzeptiert gültige Paare', () => {
    expect(sindGueltigeKoordinaten(52.52, 13.40)).toBe(true);
    expect(sindGueltigeKoordinaten(-90, 180)).toBe(true);
    expect(sindGueltigeKoordinaten(0, 0)).toBe(true);
  });

  it('lehnt Werte außerhalb der Grenzen ab', () => {
    expect(sindGueltigeKoordinaten(91, 0)).toBe(false);
    expect(sindGueltigeKoordinaten(0, 181)).toBe(false);
    expect(sindGueltigeKoordinaten(NaN, 0)).toBe(false);
  });
});

describe('parseKoordinaten', () => {
  it('liest Punkt-Dezimal, Komma-getrennt', () => {
    expect(parseKoordinaten('52.52, 13.40')).toEqual([52.52, 13.40]);
  });

  it('liest Leerzeichen-getrennt', () => {
    expect(parseKoordinaten('48.3705 10.8978')).toEqual([48.3705, 10.8978]);
  });

  it('liest deutsches Dezimalkomma (vier Zahlteile)', () => {
    expect(parseKoordinaten('48,3705, 10,8978')).toEqual([48.3705, 10.8978]);
  });

  it('ignoriert Himmelsrichtungen', () => {
    expect(parseKoordinaten('N 48.37 E 10.89')).toEqual([48.37, 10.89]);
  });

  it('liest ganzzahlige Koordinaten', () => {
    expect(parseKoordinaten('48, 10')).toEqual([48, 10]);
  });

  it('verträgt negative Werte (Süd/West)', () => {
    expect(parseKoordinaten('-33.86, 151.20')).toEqual([-33.86, 151.20]);
  });

  it('gibt null bei Unsinn oder außerhalb der Grenzen zurück', () => {
    expect(parseKoordinaten('')).toBeNull();
    expect(parseKoordinaten('Berlin')).toBeNull();
    expect(parseKoordinaten('200, 10')).toBeNull();
    expect(parseKoordinaten('52.52')).toBeNull();
  });
});
