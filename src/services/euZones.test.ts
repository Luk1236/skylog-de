import { describe, it, expect } from 'vitest';
import {
  laenderFuerKoordinate, quelleFuer, quellenFuerKoordinate,
  dipulDecktAb, istGrenzregion, ZONEN_QUELLEN,
} from './euZones';

describe('laenderFuerKoordinate', () => {
  const orte: [string, number, number, string][] = [
    ['Berlin', 52.52, 13.40, 'DE'],
    ['München', 48.14, 11.58, 'DE'],
    ['Wien', 48.21, 16.37, 'AT'],
    ['Zürich', 47.38, 8.54, 'CH'],
    ['Amsterdam', 52.37, 4.90, 'NL'],
    ['Luxemburg-Stadt', 49.61, 6.13, 'LU'],
    ['Prag', 50.08, 14.44, 'CZ'],
    ['Warschau', 52.23, 21.01, 'PL'],
    ['Kopenhagen', 55.68, 12.57, 'DK'],
  ];

  it.each(orte)('nennt für %s jedenfalls das richtige Land', (_ort, lat, lon, erwartet) => {
    expect(laenderFuerKoordinate(lat, lon)).toContain(erwartet);
  });

  it('liefert nichts weit außerhalb der Nachbarschaft', () => {
    expect(laenderFuerKoordinate(40.71, -74.0)).toEqual([]); // New York
    expect(laenderFuerKoordinate(-33.87, 151.2)).toEqual([]); // Sydney
  });

  // Der Grund für die Listen-Rückgabe: Österreichs grober Kasten enthält
  // Südbayern. Ein einzelner Rückgabewert müsste hier raten und läge für
  // München falsch.
  it('nennt in Grenznähe mehrere Kandidaten', () => {
    const muenchen = laenderFuerKoordinate(48.14, 11.58);
    expect(muenchen).toContain('DE');
    expect(muenchen.length).toBeGreaterThan(1);
    expect(istGrenzregion(48.14, 11.58)).toBe(true);
  });

  it('ist mitten im Land eindeutig', () => {
    expect(laenderFuerKoordinate(52.52, 13.40)).toEqual(['DE']); // Berlin
    expect(istGrenzregion(52.52, 13.40)).toBe(false);
  });

  it('stellt den kleinsten (spezifischsten) Kasten nach vorn', () => {
    // Luxemburg liegt komplett im groben Frankreich-Kasten.
    expect(laenderFuerKoordinate(49.61, 6.13)[0]).toBe('LU');
  });
});

describe('quelleFuer / quellenFuerKoordinate', () => {
  it('findet die amtliche Quelle zum Ländercode', () => {
    expect(quelleFuer('AT')?.url).toContain('austrocontrol.at');
  });

  it('verträgt null und Unbekanntes', () => {
    expect(quelleFuer(null)).toBeNull();
    expect(quelleFuer('XX')).toBeNull();
  });

  it('liefert für einen Standort die passenden Quellen', () => {
    const q = quellenFuerKoordinate(48.21, 16.37); // Wien
    expect(q.map((x) => x.code)).toContain('AT');
    expect(q.every((x) => x.url.startsWith('https://'))).toBe(true);
  });
});

describe('dipulDecktAb', () => {
  it('ist in Deutschland wahr', () => {
    expect(dipulDecktAb(52.52, 13.40)).toBe(true);
  });

  it('ist dort falsch, wo DIPUL systembedingt nichts zeigt', () => {
    expect(dipulDecktAb(48.21, 16.37)).toBe(false); // Wien
    expect(dipulDecktAb(52.37, 4.90)).toBe(false);  // Amsterdam
  });
});

describe('Registry-Hygiene', () => {
  it('jeder Eintrag hat Code, beide Namen und eine https-URL', () => {
    for (const q of ZONEN_QUELLEN) {
      expect(q.code).toMatch(/^[A-Z]{2}$/);
      expect(q.land.trim().length).toBeGreaterThan(0);
      expect(q.landEn.trim().length).toBeGreaterThan(0);
      expect(q.url.startsWith('https://')).toBe(true);
    }
  });

  it('keine doppelten Ländercodes', () => {
    const codes = ZONEN_QUELLEN.map((q) => q.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('für jedes erkennbare Land existiert auch eine Quelle', () => {
    for (const code of ['DE', 'AT', 'CH', 'NL', 'BE', 'LU', 'FR', 'DK', 'PL', 'CZ']) {
      expect(quelleFuer(code), `Quelle fehlt für ${code}`).not.toBeNull();
    }
  });
});
