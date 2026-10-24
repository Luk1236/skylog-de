import { describe, it, expect } from 'vitest';
import { parseSrtProben, fasseSrtZusammen, baueVorschauAusSrt, istSrt, probenZuTrack, type SrtProbe } from './djiSrt';

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

describe('probenZuTrack', () => {
  it('baut TrackPoints mit relativer Zeit, Höhe und berechnetem Speed', () => {
    const track = probenZuTrack(parseSrtProben(SRT_NEU));
    expect(track).toHaveLength(2);
    expect(track[0].t).toBe(0);
    expect(track[1].t).toBe(1);
    expect(track[0].alt).toBe(0);
    expect(track[1].alt).toBe(50);
    // zweiter Punkt hat berechnete Geschwindigkeit (>0), erster nicht
    expect(track[0].speed).toBeUndefined();
    expect(track[1].speed).toBeGreaterThan(0);
  });

  it('gibt bei leeren Proben eine leere Liste zurück', () => {
    expect(probenZuTrack([])).toEqual([]);
  });
});

describe('baueVorschauAusSrt Track', () => {
  it('hängt den vollen Track an den Kandidaten', () => {
    const v = baueVorschauAusSrt(SRT_NEU);
    expect(v.kandidaten[0].track).toBeDefined();
    expect(v.kandidaten[0].track!.length).toBe(2);
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

// Formate aus echten DJI-Dateien (Mavic Air 2, Mavic Pro, Phantom 4 Pro).
describe('echte DJI-SRT-Varianten', () => {
  it('liest die Mavic-Air-2-Variante mit [altitude] und Millisekunden im Zeitstempel', () => {
    const srt = `1
00:00:00,000 --> 00:00:00,016
<font size="36">SrtCnt : 1, DiffTime : 16ms
2022-05-01 15:01:58,531,716
[iso : 100] [latitude: 41.420684] [longitude: 2.162162] [altitude: 27.300000] </font>

2
00:00:00,500 --> 00:00:00,516
<font size="36">SrtCnt : 2, DiffTime : 16ms
2022-05-01 15:01:59,031,716
[iso : 100] [latitude: 41.420685] [longitude: 2.162162] [altitude: 28.600000] </font>`;

    const proben = parseSrtProben(srt);
    expect(proben).toHaveLength(2);
    expect(proben[0].altM).toBeCloseTo(27.3, 3);
    expect(proben[1].altM).toBeCloseTo(28.6, 3);
    expect(proben[1].zeitMs! - proben[0].zeitMs!).toBe(500);

    const z = fasseSrtZusammen(proben)!;
    expect(z.datum).toBe('2022-05-01');
    expect(z.startzeit).toBe('15:01');
    expect(z.dauerSekunden).toBe(1);
  });

  it('liest die alte Variante mit Punkten im Datum und GPS(…)', () => {
    const srt = `1
00:00:01,000 --> 00:00:02,000
HOME(149.0251,-20.2532) 2017.08.05 14:11:51
GPS(149.0251,-20.2533,16) BAROMETER:1.9

2
00:00:02,000 --> 00:00:03,000
HOME(149.0251,-20.2532) 2017.08.05 14:11:52
GPS(149.0251,-20.2533,16) BAROMETER:2.0`;

    const proben = parseSrtProben(srt);
    expect(proben).toHaveLength(2);
    expect(proben[0].lat).toBeCloseTo(-20.2533, 4);
    expect(proben[0].lon).toBeCloseTo(149.0251, 4);
    expect(proben[0].relativMs).toBe(0);

    const z = fasseSrtZusammen(proben)!;
    expect(z.datum).toBe('2017-08-05');
    expect(z.startzeit).toBe('14:11');
    expect(z.dauerSekunden).toBe(1);
  });

  it('liest die Phantom-4-Variante ohne Datum mit H …m und Datei-Zeitstempel', () => {
    const srt = `1
00:00:00,000 --> 00:00:01,000
F/3.2, SS 160, ISO 100, EV 0, GPS (8.2090, 47.4692, 18), D 49.21m, H 45.60m, H.S 0.00m/s, V.S 0.00m/s

2
00:00:02,000 --> 00:00:03,000
F/3.2, SS 160, ISO 100, EV 0, GPS (8.2090, 47.4692, 18), D 45.68m, H 45.60m, H.S 2.62m/s, V.S 0.00m/s`;

    const fallback = new Date(2024, 0, 2, 3, 4).getTime();
    const v = baueVorschauAusSrt(srt, [], fallback);
    expect(v.fehler).toHaveLength(0);
    const k = v.kandidaten[0];
    expect(k.flug.date).toBe('2024-01-02');
    expect(k.flug.startTime).toBe('03:04');
    expect(k.maxHoeheM).toBe(46);
    expect(k.track).toHaveLength(2);
    expect(k.track![1].t).toBe(2);
    expect(k.hinweise[0].de).toContain('Kein Datum');
    expect(k.hinweise[0].en).toContain('No date');
  });

  it('meldet ein fehlendes Datum klar, wenn kein Datei-Zeitstempel vorliegt', () => {
    const srt = `1
00:00:00,000 --> 00:00:01,000
GPS (8.2090, 47.4692, 18), H 45.60m`;
    const v = baueVorschauAusSrt(srt);
    expect(v.kandidaten).toHaveLength(0);
    expect(v.fehler.map(f => f.de).join(' ')).toContain('kein Datum');
    expect(v.fehler.map(f => f.en).join(' ')).toContain('no date');
  });

  it('liest die Mavic-2-Variante mit "longtitude" und ohne SRT-Zeitcode', () => {
    const srt = `1
2017.08.05 14:11:51,393,525,393,525
[latitude : -20.2533] [longtitude : 149.0251] [iso : 100] [shutter : 1/60.0]

2
2017.08.05 14:11:52,393,525
[latitude : -20.2534] [longtitude : 149.0252] [iso : 100] [shutter : 1/60.0]`;
    const proben = parseSrtProben(srt);
    expect(proben).toHaveLength(2);
    expect(proben[0].lat).toBeCloseTo(-20.2533, 4);
    expect(proben[0].lon).toBeCloseTo(149.0251, 4);
    const z = fasseSrtZusammen(proben)!;
    expect(z.datum).toBe('2017-08-05');
    expect(z.dauerSekunden).toBe(1);
  });

  it('liest die alte Phantom-Variante mit einstelligem Datum und Hb/Hs', () => {
    const srt = `1
00:00:01,000 --> 00:00:02,000
HOME(149.0251,-20.2532) 2017.8.5 14:11:51
GPS(149.0251,-20.2533,16) Hb:1.9 Hs:1.9

2
00:00:02,000 --> 00:00:03,000
HOME(149.0251,-20.2532) 2017.8.5 14:11:52
GPS(149.0251,-20.2533,16) Hb:2.0 Hs:2.0`;
    const proben = parseSrtProben(srt);
    expect(proben).toHaveLength(2);
    expect(proben[0].altM).toBeCloseTo(1.9, 3);
    const z = fasseSrtZusammen(proben)!;
    expect(z.datum).toBe('2017-08-05');
    expect(z.startzeit).toBe('14:11');
  });

  it('speichert Flüge unter einer Minute als 1 Minute und weist darauf hin', () => {
    const srt = `1
00:00:00,000 --> 00:00:01,000
2023-05-01 10:15:30.000
[latitude: 48.1] [longitude: 7.9] [rel_alt: 0]

2
00:00:20,000 --> 00:00:21,000
2023-05-01 10:15:50.000
[latitude: 48.1] [longitude: 7.9] [rel_alt: 20]`;
    const v = baueVorschauAusSrt(srt);
    const k = v.kandidaten[0];
    expect(k.flug.duration).toBe(1);
    expect(k.hinweise.some(h => h.de.includes('unter einer Minute'))).toBe(true);
    expect(k.hinweise.some(h => h.en.includes('under one minute'))).toBe(true);
  });

  it('dünnt sehr große Flugspuren auf höchstens 2000 Punkte aus', () => {
    const proben: SrtProbe[] = Array.from({ length: 5000 }, (_, i) => ({
      relativMs: i * 100,
      lat: 48 + i * 0.000001,
      lon: 7,
    }));
    const track = probenZuTrack(proben);
    expect(track.length).toBeLessThanOrEqual(2000);
    expect(track[0].t).toBe(0);
    expect(track[track.length - 1].t).toBe(499.9);
  });
});
