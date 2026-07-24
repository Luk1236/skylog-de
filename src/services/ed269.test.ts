import { describe, it, expect } from 'vitest';
import {
  parseEd269, zonenAnPunkt, punktInRing, stufeFuer, bewerteZonen,
} from './ed269';
import echteZonen from './__fixtures__/ed269-austria.json';

// Die Probe stammt aus einer echten Austro-Control-Datei (2026-07-24),
// je eine Zone pro Beschränkungsstufe. Gegen erfundene Testdaten hätte der
// Parser nichts bewiesen — die realen Eigenheiten (Array statt Objekt, BOM,
// [lon,lat], Höhen je Geometrie) sieht man nur an echten Daten.
const roh = JSON.stringify(echteZonen);

describe('parseEd269 mit echten Daten', () => {
  const zonen = parseEd269(roh);

  it('liest alle vier Zonen der Probe', () => {
    expect(zonen).toHaveLength(4);
  });

  it('übernimmt Land, Name und Beschränkung', () => {
    expect(zonen.every((z) => z.land === 'AUT')).toBe(true);
    expect(zonen.map((z) => z.beschraenkung).sort()).toEqual(
      ['CONDITIONAL', 'NO_RESTRICTION', 'PROHIBITED', 'REQ_AUTHORISATION']
    );
  });

  it('dreht die Koordinaten von [lon,lat] auf Leaflets [lat,lon]', () => {
    const [lat, lon] = zonen[0].polygone[0][0];
    // Österreich: Breite ~46–49, Länge ~9–17. Ungedreht wären die Werte vertauscht.
    expect(lat).toBeGreaterThan(45);
    expect(lat).toBeLessThan(50);
    expect(lon).toBeGreaterThan(9);
    expect(lon).toBeLessThan(18);
  });

  it('liest die Höhengrenzen je Geometrie', () => {
    const mitHoehe = zonen.find((z) => z.obergrenzeM !== undefined);
    expect(mitHoehe).toBeDefined();
    expect(mitHoehe!.obergrenzeM).toBeGreaterThan(0);
  });

  it('jede Zone hat mindestens einen Ring mit drei Punkten', () => {
    for (const z of zonen) {
      expect(z.polygone.length).toBeGreaterThan(0);
      expect(z.polygone[0].length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Robustheit', () => {
  it('verträgt ein UTF-8-BOM am Dateianfang', () => {
    // Genau daran scheitert JSON.parse bei der echten Datei.
    const mitBom = '﻿' + roh;
    expect(parseEd269(mitBom)).toHaveLength(4);
  });

  it('meldet klar, wenn es kein JSON ist', () => {
    expect(() => parseEd269('<html>nope</html>')).toThrow(/JSON/i);
  });

  it('meldet klar, wenn die Struktur nicht passt', () => {
    expect(() => parseEd269('{"features":[]}')).toThrow(/ED-269/i);
  });

  it('überspringt Zonen ohne darstellbare Fläche', () => {
    const ohne = JSON.stringify([{ zoneId: 'x', name: 'leer', country: 'AUT', restriction: 'PROHIBITED', geometry: [] }]);
    expect(parseEd269(ohne)).toEqual([]);
  });

  it('rechnet Fuß in Meter um', () => {
    const ft = JSON.stringify([{
      zoneId: 'f', name: 'FT', country: 'AUT', restriction: 'PROHIBITED',
      geometry: [{
        lowerLimit: 0, upperLimit: 1000, uomDimensions: 'FT',
        horizontalProjection: { type: 'Polygon', coordinates: [[[16, 48], [16.1, 48], [16.1, 48.1], [16, 48]]] },
      }],
    }]);
    expect(parseEd269(ft)[0].obergrenzeM).toBe(305);
  });

  it('nähert eine Kreis-Geometrie als Ring an', () => {
    const kreis = JSON.stringify([{
      zoneId: 'k', name: 'Kreis', country: 'AUT', restriction: 'PROHIBITED',
      geometry: [{ horizontalProjection: { type: 'Circle', center: [16.37, 48.21], radius: 500 } }],
    }]);
    const z = parseEd269(kreis);
    expect(z).toHaveLength(1);
    expect(z[0].polygone[0].length).toBeGreaterThan(10);
    expect(zonenAnPunkt(z, 48.21, 16.37)).toHaveLength(1);
  });
});

describe('punktInRing / zonenAnPunkt', () => {
  const quadrat: [number, number][] = [[48, 16], [48, 17], [49, 17], [49, 16], [48, 16]];

  it('erkennt innen und außen', () => {
    expect(punktInRing(quadrat, 48.5, 16.5)).toBe(true);
    expect(punktInRing(quadrat, 47.0, 16.5)).toBe(false);
    expect(punktInRing(quadrat, 48.5, 18.0)).toBe(false);
  });

  it('findet für einen Punkt in der echten Zone genau diese', () => {
    const zonen = parseEd269(roh);
    const ring = zonen[0].polygone[0];
    // Schwerpunkt des Rings liegt bei diesen kleinen Flächen im Inneren.
    const lat = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const lon = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    expect(zonenAnPunkt(zonen, lat, lon).length).toBeGreaterThan(0);
  });

  it('liefert nichts weit weg', () => {
    expect(zonenAnPunkt(parseEd269(roh), 52.52, 13.40)).toEqual([]); // Berlin
  });
});

describe('Bewertung', () => {
  it('bildet die Beschränkungen auf die Ampel ab', () => {
    expect(stufeFuer('PROHIBITED')).toBe('kritisch');
    expect(stufeFuer('REQ_AUTHORISATION')).toBe('hinweis');
    expect(stufeFuer('NO_RESTRICTION')).toBe('frei');
  });

  // „Unter Bedingungen" heißt, dass es Bedingungen gibt — nicht dass frei ist.
  it('wertet CONDITIONAL als Hinweis, nicht als frei', () => {
    expect(stufeFuer('CONDITIONAL')).toBe('hinweis');
  });

  it('die strengste Zone bestimmt das Gesamturteil', () => {
    const zonen = parseEd269(roh);
    expect(bewerteZonen(zonen)).toBe('kritisch');
    expect(bewerteZonen(zonen.filter((z) => z.beschraenkung === 'NO_RESTRICTION'))).toBe('frei');
    expect(bewerteZonen([])).toBe('frei');
  });
});
