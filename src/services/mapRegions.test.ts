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

// Beim Browser-Test fiel auf, dass die Region namens „Berlin / Magdeburg /
// Potsdam" Berlin gar nicht enthielt — der Kasten endet bei 12,7° Ost, Berlin
// liegt bei 13,4°. Insgesamt waren 7 Ortsangaben falsch. Ein Name, der einen
// Ort verspricht, den die Datei nicht abdeckt, führt direkt zum falschen
// Download. Dieser Test hält Namen und Kasten zusammen.
describe('Namen sagen die Wahrheit', () => {
  const koordinaten: Record<string, [number, number]> = {
    Hamburg: [53.55, 9.99], Bremen: [53.08, 8.80], Kiel: [54.32, 10.14],
    'Lübeck': [53.87, 10.69], 'Osnabrück': [52.28, 8.05], Hannover: [52.37, 9.73],
    Bielefeld: [52.02, 8.53], Kassel: [51.31, 9.50], Magdeburg: [52.13, 11.63],
    Braunschweig: [52.27, 10.52], Leipzig: [51.34, 12.37], Berlin: [52.52, 13.40],
    Potsdam: [52.40, 13.06], Cottbus: [51.76, 14.33], 'Köln': [50.94, 6.96],
    Bonn: [50.73, 7.10], Trier: [49.76, 6.64], 'Saarbrücken': [49.24, 7.00],
    Frankfurt: [50.11, 8.68], Mainz: [49.99, 8.27], 'Würzburg': [49.79, 9.93],
    Erfurt: [50.98, 11.03], 'Nürnberg': [49.45, 11.08], Jena: [50.93, 11.59],
    Dresden: [51.05, 13.74], Chemnitz: [50.83, 12.92], Freiburg: [47.99, 7.85],
    Stuttgart: [48.78, 9.18], Karlsruhe: [49.01, 8.40], Ulm: [48.40, 9.99],
    'München': [48.14, 11.58], Augsburg: [48.37, 10.90], Regensburg: [49.01, 12.10],
    Passau: [48.57, 13.46],
  };

  it('jeder im Namen genannte Ort liegt auch im Kasten der Region', () => {
    const luegen: string[] = [];
    for (const r of REGIONEN) {
      for (const teil of r.name.split('/').map((s) => s.trim())) {
        const c = koordinaten[teil];
        if (!c) continue; // Landschaftsnamen wie „Schwarzwald" haben keine Koordinate
        if (!regionEnthaelt(r, c[0], c[1])) {
          luegen.push(`"${r.name}" (${r.code}) enthält ${teil} nicht`);
        }
      }
    }
    expect(luegen).toEqual([]);
  });

  it('Berlin liegt in der Region, die Berlin im Namen führt', () => {
    const [lat, lon] = koordinaten.Berlin;
    const treffer = regionenFuerStandort(lat, lon);
    expect(treffer.some((r) => r.name.includes('Berlin'))).toBe(true);
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
    expect(regionFuerCode('de-muenchen')?.name).toContain('München');
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
    const muenchen = regionFuerCode('de-muenchen')!;
    expect(regionEnthaelt(muenchen, 48.14, 11.58)).toBe(true);  // München
    expect(regionEnthaelt(muenchen, 53.55, 9.99)).toBe(false);  // Hamburg
  });
});
