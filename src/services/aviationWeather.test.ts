import { describe, it, expect } from 'vitest';
import {
  bboxUm, naechsteStation, bewerteFltCat, knotenInKmh, zuStation,
  type MetarStation,
} from './aviationWeather';

function station(over: Partial<MetarStation> = {}): MetarStation {
  return {
    icaoId: 'EDDF', name: 'Frankfurt', lat: 50.045, lon: 8.598,
    temp: 17, dewp: 8, wdir: 290, wspd: 11, visib: '6+', altim: 1021,
    fltCat: 'VFR', rawOb: 'METAR EDDF ...', obsTime: 1784791200, ...over,
  };
}

describe('bboxUm', () => {
  it('liefert vier Werte in der Reihenfolge minLat,minLon,maxLat,maxLon', () => {
    const teile = bboxUm(50, 8, 111).split(',').map(Number);
    expect(teile).toHaveLength(4);
    const [minLat, minLon, maxLat, maxLon] = teile;
    expect(minLat).toBeLessThan(maxLat);
    expect(minLon).toBeLessThan(maxLon);
  });

  it('umschließt den Punkt', () => {
    const [minLat, minLon, maxLat, maxLon] = bboxUm(49.87, 8.65, 60).split(',').map(Number);
    expect(49.87).toBeGreaterThan(minLat);
    expect(49.87).toBeLessThan(maxLat);
    expect(8.65).toBeGreaterThan(minLon);
    expect(8.65).toBeLessThan(maxLon);
  });

  it('macht das Fenster in Längsrichtung nach Norden hin breiter', () => {
    const breiteBei50 = (() => { const t = bboxUm(50, 8, 60).split(',').map(Number); return t[3] - t[1]; })();
    const breiteBei0  = (() => { const t = bboxUm(0, 8, 60).split(',').map(Number); return t[3] - t[1]; })();
    expect(breiteBei50).toBeGreaterThan(breiteBei0);
  });
});

describe('naechsteStation', () => {
  it('wählt die räumlich nächste', () => {
    const nah = station({ icaoId: 'NAH', lat: 49.88, lon: 8.66 });
    const fern = station({ icaoId: 'FERN', lat: 52.5, lon: 13.4 });
    expect(naechsteStation([fern, nah], 49.87, 8.65)?.icaoId).toBe('NAH');
  });

  it('setzt die Entfernung in km', () => {
    const s = naechsteStation([station({ lat: 49.88, lon: 8.65 })], 49.87, 8.65);
    expect(s?.entfernungKm).toBeGreaterThan(0);
    expect(s?.entfernungKm).toBeLessThan(3);
  });

  it('ist null ohne Stationen', () => {
    expect(naechsteStation([], 49.87, 8.65)).toBeNull();
  });

  it('überspringt Stationen ohne brauchbare Koordinaten', () => {
    const kaputt = station({ icaoId: 'KAPUTT', lat: NaN, lon: NaN });
    const gut = station({ icaoId: 'GUT', lat: 49.9, lon: 8.7 });
    expect(naechsteStation([kaputt, gut], 49.87, 8.65)?.icaoId).toBe('GUT');
  });
});

describe('bewerteFltCat', () => {
  it('erkennt VFR als gute Lage', () => {
    expect(bewerteFltCat('VFR').lage).toBe('gut');
  });
  it('erkennt MVFR als eingeschränkt', () => {
    expect(bewerteFltCat('MVFR').lage).toBe('eingeschraenkt');
  });
  it('wertet IFR und LIFR als schlecht', () => {
    expect(bewerteFltCat('IFR').lage).toBe('schlecht');
    expect(bewerteFltCat('LIFR').lage).toBe('schlecht');
  });
  it('kommt mit fehlender Angabe klar', () => {
    expect(bewerteFltCat(null).lage).toBe('unbekannt');
  });
});

describe('knotenInKmh', () => {
  it('rechnet Knoten in km/h', () => {
    expect(knotenInKmh(10)).toBe(19);
    expect(knotenInKmh(0)).toBe(0);
  });
});

describe('zuStation', () => {
  it('übernimmt die Felder der Rohantwort', () => {
    const s = zuStation({
      icaoId: 'EDDF', name: 'Frankfurt/Main', lat: 50.045, lon: 8.598,
      temp: 17, dewp: 8, wdir: 290, wspd: 11, visib: '6+', altim: 1021,
      fltCat: 'VFR', rawOb: 'METAR EDDF 230720Z', obsTime: 1784791200,
    });
    expect(s.icaoId).toBe('EDDF');
    expect(s.temp).toBe(17);
    expect(s.fltCat).toBe('VFR');
    expect(s.rawOb).toContain('METAR');
  });

  it('macht aus fehlenden Zahlen null statt NaN', () => {
    const s = zuStation({ icaoId: 'X', lat: 1, lon: 2 });
    expect(s.temp).toBeNull();
    expect(s.wspd).toBeNull();
    expect(s.visib).toBeNull();
  });

  it('verträgt Zahlen als Text', () => {
    expect(zuStation({ temp: '17', wspd: '11' }).temp).toBe(17);
  });
});
