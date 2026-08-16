import { describe, it, expect } from 'vitest';
import { parseSrtProben, fasseSrtZusammen, baueVorschauAusSrt, istSrt } from './djiSrt';

// Neue DJI-Variante: benannte Felder [latitude]/[longitude]/[rel_alt].
const SRT_NEU = `1
00:00:00,000 --> 00:00:01,000
<font size="28">SrtCnt : 1, DiffTime : 1000ms
2023-05-01 10:15:30.000
[iso : 100] [latitude: 48.100000] [longitude: 7.900000] [rel_alt: 0.000 abs_alt: 200.000] </font>

2
00:00:01,000 --> 00:00:02,000
<font size="28">SrtCnt : 2, DiffTime : 1000ms
2023-05-01 10:15:31.000
[iso : 100] [latitude: 48.101000] [longitude: 7.900000] [rel_alt: 50.000 abs_alt: 250.000] </font>
`;

// Alte DJI-Variante: GPS (LON, LAT, Satelliten) und BAROMETER.
const SRT_ALT = `1
00:00:00,000 --> 00:00:01,000
<font size="36">FrameCnt : 1, DiffTime : 1000ms
2020-06-15 14:30:00,000,000
[iso : 100] [shutter : 1/1000] GPS (7.900000,48.100000,14) BAROMETER: 0.10 </font>

2
00:00:01,000 --> 00:00:02,000
<font size="36">FrameCnt : 2
2020-06-15 14:30:02,000,000
GPS (7.900000,48.100500,15) BAROMETER: 30.50 </font>
`;

describe('parseSrtProben', () => {
  it('liest die neue Variante (benannte Felder)', () => {
    const proben = parseSrtProben(SRT_NEU);
    expect(proben).toHaveLength(2);
    expect(proben[0].lat).toBeCloseTo(48.1, 5);
    expect(proben[0].lon).toBeCloseTo(7.9, 5);
    expect(proben[1].altM).toBe(50);
  });

  it('liest die alte Variante mit GPS(LON,LAT) — Reihenfolge korrekt gedreht', () => {
    const proben = parseSrtProben(SRT_ALT);
    expect(proben).toHaveLength(2);
    // lat muss 48.x sein, lon 7.x — nicht vertauscht.
    expect(proben[0].lat).toBeCloseTo(48.1, 4);
    expect(proben[0].lon).toBeCloseTo(7.9, 4);
    expect(proben[1].altM).toBe(30.5);
  });

  it('ignoriert Blöcke ohne Position', () => {
    expect(parseSrtProben('kein\n\nsinnvoller\n\ninhalt')).toHaveLength(0);
  });
});

describe('fasseSrtZusammen', () => {
  it('verdichtet zu Start, Dauer, Höhe und Distanz', () => {
    const z = fasseSrtZusammen(parseSrtProben(SRT_NEU))!;
    expect(z.datum).toBe('2023-05-01');
    expect(z.startzeit).toBe('10:15');
    expect(z.dauerSekunden).toBe(1);
    expect(z.start[0]).toBeCloseTo(48.1, 5);
    expect(z.maxHoeheM).toBe(50);
    // 0.001° Breite ≈ 111 m.
    expect(z.maxDistanzM).toBeGreaterThan(100);
    expect(z.maxDistanzM).toBeLessThan(120);
  });

  it('gibt null ohne Proben zurück', () => {
    expect(fasseSrtZusammen([])).toBeNull();
  });
});

describe('baueVorschauAusSrt', () => {
  it('erzeugt genau einen Flug-Kandidaten', () => {
    const v = baueVorschauAusSrt(SRT_ALT);
    expect(v.fehler).toHaveLength(0);
    expect(v.kandidaten).toHaveLength(1);
    const k = v.kandidaten[0];
    expect(k.flug.date).toBe('2020-06-15');
    expect(k.flug.startTime).toBe('14:30');
    expect(k.distanzM).toBeGreaterThan(0);
    expect(k.maxHoeheM).toBe(31); // gerundet aus 30.5
  });

  it('meldet einen Fehler, wenn keine Position gefunden wird', () => {
    const v = baueVorschauAusSrt('nur text\n\nohne gps');
    expect(v.kandidaten).toHaveLength(0);
    expect(v.fehler.length).toBeGreaterThan(0);
  });
});

describe('istSrt', () => {
  it('erkennt an der Dateiendung', () => {
    expect(istSrt('DJI_0001.SRT', '')).toBe(true);
  });
  it('erkennt am Timecode-Kopf', () => {
    expect(istSrt('irgendwas.txt', SRT_NEU)).toBe(true);
  });
  it('lehnt CSV ab', () => {
    expect(istSrt('flug.csv', 'date,duration\n2023-01-01,120')).toBe(false);
  });
});
