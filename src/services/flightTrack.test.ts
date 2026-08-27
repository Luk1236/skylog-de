import { describe, it, expect } from 'vitest';
import { parseTrackCsv, berechneTrackStats, distanzMeter, inKmh, analysiereTrack } from './flightTrack';
import type { TrackPoint } from './db';

describe('analysiereTrack', () => {
  // Punkte in ~111 m Schritten pro 0.001° Breite; hier klein gehalten.
  const basis = (over: Partial<TrackPoint>[]): TrackPoint[] =>
    over.map((o, i) => ({ t: i, lat: 48.1, lon: 7.9, ...o }));

  it('warnt bei Höhe über 120 m', () => {
    const w = analysiereTrack(basis([{ alt: 10 }, { alt: 130 }]));
    expect(w.some(x => x.stufe === 'warnung' && /120/.test(x.text))).toBe(true);
  });

  it('meldet kritisch niedrigen Akku', () => {
    const w = analysiereTrack(basis([{ battery: 60 }, { battery: 8 }]));
    expect(w.some(x => x.stufe === 'kritisch' && /Akku/.test(x.text))).toBe(true);
  });

  it('warnt bei niedrigem Akku bei Landung (aber nicht kritisch)', () => {
    const w = analysiereTrack(basis([{ battery: 60 }, { battery: 20 }]));
    expect(w.some(x => x.stufe === 'warnung' && /Landung/.test(x.text))).toBe(true);
    expect(w.some(x => x.stufe === 'kritisch')).toBe(false);
  });

  it('warnt bei großer Entfernung (VLOS)', () => {
    const w = analysiereTrack([
      { t: 0, lat: 48.1, lon: 7.9 },
      { t: 10, lat: 48.11, lon: 7.9 }, // ~1,1 km
    ]);
    expect(w.some(x => /VLOS|Entfernung/.test(x.text))).toBe(true);
  });

  it('gibt keine Warnungen bei einem sauberen, niedrigen Kurzflug', () => {
    const w = analysiereTrack(basis([{ alt: 30, battery: 90 }, { alt: 35, battery: 85 }]));
    expect(w).toHaveLength(0);
  });

  it('liefert nichts bei zu wenigen Punkten', () => {
    expect(analysiereTrack([{ t: 0, lat: 48.1, lon: 7.9 }])).toEqual([]);
  });
});

describe('inKmh', () => {
  it('rechnet mph und m/s um', () => {
    expect(inKmh(10, 'mph')).toBeCloseTo(16.09, 1);
    expect(inKmh(10, 'm/s')).toBeCloseTo(36);
    expect(inKmh(10, 'km/h')).toBe(10);
  });
});

describe('distanzMeter (Haversine)', () => {
  it('misst kurze Strecken plausibel', () => {
    // ~111 m pro 0.001° Breite
    expect(distanzMeter(49.870, 8.650, 49.871, 8.650)).toBeCloseTo(111, -1);
  });
  it('ist null bei identischen Punkten', () => {
    expect(distanzMeter(49.87, 8.65, 49.87, 8.65)).toBe(0);
  });
});

describe('parseTrackCsv', () => {
  const csv = [
    'time(milliseconds),latitude,longitude,height_above_takeoff(feet),speed(mph),battery_percent',
    '0,49.8700,8.6500,0,0,100',
    '1000,49.8701,8.6500,32.8,11.18,99',
    '2000,49.8702,8.6501,65.6,22.37,98',
  ].join('\n');

  it('erzeugt einen Punkt je Datenzeile', () => {
    const { track, fehler } = parseTrackCsv(csv);
    expect(fehler).toHaveLength(0);
    expect(track).toHaveLength(3);
  });

  it('normalisiert die Zeit auf Sekunden ab Start', () => {
    const { track } = parseTrackCsv(csv);
    expect(track[0].t).toBe(0);
    expect(track[1].t).toBe(1);
    expect(track[2].t).toBe(2);
  });

  it('rechnet Fuß in Meter und mph in km/h', () => {
    const { track } = parseTrackCsv(csv);
    expect(track[1].alt).toBeCloseTo(10, 0);   // 32.8 ft ≈ 10 m
    expect(track[1].speed).toBeCloseTo(18, 0);  // 11.18 mph ≈ 18 km/h
    expect(track[1].battery).toBe(99);
  });

  it('überspringt Zeilen ohne Koordinaten', () => {
    const luecke = 'latitude,longitude\n49.87,8.65\n,\n49.88,8.66';
    expect(parseTrackCsv(luecke).track).toHaveLength(2);
  });

  it('meldet Fehler, wenn keine Koordinaten erkannt werden', () => {
    const ohne = 'time,height\n0,10\n1,20';
    expect(parseTrackCsv(ohne).fehler.join(' ')).toMatch(/Koordinaten/);
  });

  it('nutzt den Zeilenindex, wenn keine Zeitspalte da ist', () => {
    const ohneZeit = 'latitude,longitude\n49.87,8.65\n49.88,8.66';
    const { track } = parseTrackCsv(ohneZeit);
    expect(track[0].t).toBe(0);
    expect(track[1].t).toBe(1);
  });
});

describe('berechneTrackStats', () => {
  const track: TrackPoint[] = [
    { t: 0, lat: 49.870, lon: 8.650, alt: 0, speed: 0, battery: 100 },
    { t: 10, lat: 49.871, lon: 8.650, alt: 50, speed: 30, battery: 90 },
    { t: 20, lat: 49.872, lon: 8.650, alt: 120, speed: 45, battery: 80 },
  ];

  it('findet Max-Höhe und Max-Speed', () => {
    const s = berechneTrackStats(track);
    expect(s.maxHoeheM).toBe(120);
    expect(s.maxSpeedKmh).toBe(45);
  });

  it('berechnet Dauer und Punktzahl', () => {
    const s = berechneTrackStats(track);
    expect(s.dauerS).toBe(20);
    expect(s.punkte).toBe(3);
  });

  it('summiert Strecke und misst größte Entfernung vom Start', () => {
    const s = berechneTrackStats(track);
    expect(s.distanzM).toBeGreaterThan(200);   // ~222 m gesamt
    expect(s.maxDistanzM).toBeCloseTo(222, -1); // Endpunkt ~222 m vom Start
  });

  it('kommt mit leerem Track zurecht', () => {
    const s = berechneTrackStats([]);
    expect(s.punkte).toBe(0);
    expect(s.maxHoeheM).toBeNull();
  });

  it('lässt Höhe/Speed null, wenn keine Punkte sie haben', () => {
    const nur = [{ t: 0, lat: 49.87, lon: 8.65 }, { t: 1, lat: 49.88, lon: 8.66 }];
    const s = berechneTrackStats(nur);
    expect(s.maxHoeheM).toBeNull();
    expect(s.maxSpeedKmh).toBeNull();
  });
});
