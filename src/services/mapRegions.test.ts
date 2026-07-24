import { describe, it, expect } from 'vitest';
import {
  REGIONEN, RELEASE_BASIS, regionFuerCode, regionUrl, quellUrl,
  regionEnthaelt, regionenFuerStandort,
} from './mapRegions';

// Der eigentlich wertvolle Test: Handgemachte Kästen lassen leicht Lücken.
// Fällt eine Stadt durch, fehlt für ihre Gegend eine herunterladbare Karte.
const staedte: [string, number, number][] = [
  ['Hamburg', 53.55, 9.99],
  ['Bremen', 53.08, 8.80],
  ['Rostock', 54.09, 12.14],
  ['Berlin', 52.52, 13.40],
  ['Hannover', 52.37, 9.73],
  ['Köln', 50.94, 6.96],
  ['Düsseldorf', 51.23, 6.78],
  ['Dortmund', 51.51, 7.47],
  ['Frankfurt am Main', 50.11, 8.68],
  ['Leipzig', 51.34, 12.37],
  ['Dresden', 51.05, 13.74],
  ['Erfurt', 50.98, 11.03],
  ['Nürnberg', 49.45, 11.08],
  ['Stuttgart', 48.78, 9.18],
  ['München', 48.14, 11.58],
  ['Freiburg', 47.99, 7.85],
  ['Saarbrücken', 49.24, 6.996],
];

describe('Abdeckung', () => {
  it.each(staedte)('%s liegt in mindestens einer Region', (_name, lat, lon) => {
    expect(regionenFuerStandort(lat, lon).length).toBeGreaterThan(0);
  });

  it('liefert weit außerhalb Deutschlands nichts', () => {
    expect(regionenFuerStandort(40.71, -74.0)).toEqual([]); // New York
    expect(regionenFuerStandort(-33.87, 151.2)).toEqual([]); // Sydney
  });

  // Strenger als Stadt-Stichproben: Die Fläche Deutschlands wird abgerastert.
  // Genau so ist das Loch bei Hannover aufgefallen, das fünf knapp
  // zugeschnittene Regionen gelassen hatten.
  it('deckt die Fläche Deutschlands lückenlos ab', () => {
    const luecken: string[] = [];
    for (let lat = 47.3; lat <= 55.0; lat += 0.25) {
      for (let lon = 6.0; lon <= 15.0; lon += 0.25) {
        if (regionenFuerStandort(lat, lon).length === 0) {
          luecken.push(`${lat.toFixed(2)}/${lon.toFixed(2)}`);
        }
      }
    }
    expect(luecken).toEqual([]);
  });
});

describe('Katalog-Hygiene', () => {
  it('Codes und Dateinamen sind eindeutig', () => {
    const codes = REGIONEN.map((r) => r.code);
    const dateien = REGIONEN.map((r) => r.datei);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(dateien).size).toBe(dateien.length);
  });

  it('jede Region hat einen gültigen Kasten und sinnvollen Zoom', () => {
    for (const r of REGIONEN) {
      expect(r.bbox.minLon).toBeLessThan(r.bbox.maxLon);
      expect(r.bbox.minLat).toBeLessThan(r.bbox.maxLat);
      expect(r.maxZoom).toBeGreaterThanOrEqual(10);
      expect(r.maxZoom).toBeLessThanOrEqual(16);
      expect(r.datei).toMatch(/\.pmtiles$/);
      expect(r.name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('regionFuerCode', () => {
  it('findet eine Region', () => {
    expect(regionFuerCode('de-suedost')?.name).toBe('Deutschland Südost');
  });
  it('liefert null bei Unbekanntem', () => {
    expect(regionFuerCode('gibt-es-nicht')).toBeNull();
  });
});

describe('URLs', () => {
  const region = REGIONEN[0];

  it('baut die Release-URL', () => {
    expect(regionUrl(region)).toBe(`${RELEASE_BASIS}/${region.datei}`);
  });

  it('erlaubt eine andere Basis (z.B. für Tests oder eine Spiegelung)', () => {
    expect(regionUrl(region, 'https://example.com/karten')).toBe(
      `https://example.com/karten/${region.datei}`
    );
  });

  // GitHub liefert zu Release-Assets keine CORS-Header. Nativ umgeht
  // CapacitorHttp das, im Web muss der Proxy davor.
  it('nutzt nativ die Direkt-URL, im Web den Proxy', () => {
    expect(quellUrl(region, true)).toBe(regionUrl(region));
    expect(quellUrl(region, false)).toBe(`/api/karte/${region.datei}`);
  });
});

describe('regionEnthaelt', () => {
  it('trifft innen und verneint außen', () => {
    const suedost = regionFuerCode('de-suedost')!;
    expect(regionEnthaelt(suedost, 48.14, 11.58)).toBe(true);  // München
    expect(regionEnthaelt(suedost, 53.55, 9.99)).toBe(false);  // Hamburg
  });
});
