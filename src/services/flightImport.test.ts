import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  erkenneTrennzeichen,
  ordneSpaltenZu,
  leseZahl,
  leseDauer,
  leseDatum,
  inMeter,
  istDublette,
  baueVorschau,
  passendeDrohne,
  berechneEndzeit,
  zuFlug,
} from './flightImport';
import type { Flight, Drone } from './db';

describe('CSV-Zerlegung', () => {
  it('erkennt Semikolon in deutschen Exporten', () => {
    expect(erkenneTrennzeichen('Datum;Dauer;Ort')).toBe(';');
    expect(erkenneTrennzeichen('Date,Duration,Location')).toBe(',');
  });

  it('lässt Trennzeichen innerhalb von Anführungszeichen in Ruhe', () => {
    const csv = 'Date,Location\n2026-07-19,"Darmstadt, Hessen"';
    const zeilen = parseCsv(csv);
    expect(zeilen[1]).toEqual(['2026-07-19', 'Darmstadt, Hessen']);
  });

  it('versteht verdoppelte Anführungszeichen als Zeichen', () => {
    const csv = 'A\n"Er sagte ""Stopp"""';
    expect(parseCsv(csv)[1][0]).toBe('Er sagte "Stopp"');
  });

  it('entfernt das BOM aus Excel-Exporten', () => {
    const zeilen = parseCsv('﻿Date,Duration\n2026-07-19,120');
    expect(zeilen[0][0]).toBe('Date');
  });

  it('überspringt Leerzeilen', () => {
    const zeilen = parseCsv('A,B\n1,2\n\n3,4\n');
    expect(zeilen).toHaveLength(3);
  });
});

describe('Spaltenzuordnung', () => {
  it('erkennt englische und deutsche Köpfe gleichermaßen', () => {
    const en = ordneSpaltenZu(['Date', 'Duration', 'Latitude', 'Longitude']);
    expect(en.zuordnung.datum?.index).toBe(0);
    expect(en.zuordnung.dauer?.index).toBe(1);

    const de = ordneSpaltenZu(['Datum', 'Flugzeit', 'Breitengrad', 'Längengrad']);
    expect(de.zuordnung.datum?.index).toBe(0);
    expect(de.zuordnung.dauer?.index).toBe(1);
    expect(de.zuordnung.breite?.index).toBe(2);
  });

  it('liest die Einheit aus der Klammer im Kopf', () => {
    const { zuordnung } = ordneSpaltenZu(['Date', 'Duration', 'Max Height (ft)']);
    expect(zuordnung.maxHoehe?.einheit).toBe('ft');
  });

  it('vergibt jede Spalte nur einmal', () => {
    // 'Start Time' passt auf datum UND startzeit — darf nicht doppelt landen
    const { zuordnung } = ordneSpaltenZu(['Start Time', 'Duration']);
    const indizes = Object.values(zuordnung).map(t => t.index);
    expect(new Set(indizes).size).toBe(indizes.length);
  });

  it('meldet unbekannte Spalten zurück, statt sie zu verschlucken', () => {
    const { nichtZugeordnet } = ordneSpaltenZu(['Date', 'Duration', 'Irgendwas']);
    expect(nichtZugeordnet).toContain('Irgendwas');
  });
});

describe('Zahlen', () => {
  it('versteht deutsche und englische Dezimaltrennung', () => {
    expect(leseZahl('1.234,56')).toBeCloseTo(1234.56);
    expect(leseZahl('1,234.56')).toBeCloseTo(1234.56);
    expect(leseZahl('49,87')).toBeCloseTo(49.87);
  });

  it('liefert null statt NaN bei Unsinn', () => {
    expect(leseZahl('')).toBeNull();
    expect(leseZahl('k.A.')).toBeNull();
  });
});

describe('Einheiten', () => {
  it('rechnet Fuß in Meter um', () => {
    expect(inMeter(100, 'ft')).toBeCloseTo(30.48);
  });

  it('lässt Meter unverändert und behandelt Unbekanntes als Meter', () => {
    expect(inMeter(120, 'm')).toBe(120);
    expect(inMeter(120, undefined)).toBe(120);
  });
});

describe('Flugdauer', () => {
  it('versteht mm:ss und hh:mm:ss', () => {
    expect(leseDauer('3:05')).toBe(185);
    expect(leseDauer('1:02:03')).toBe(3723);
  });

  it('respektiert die Einheit aus dem Kopf', () => {
    expect(leseDauer('12', 'min')).toBe(720);
    expect(leseDauer('720', 's')).toBe(720);
  });

  it('deutet kleine einheitenlose Zahlen als Minuten', () => {
    // 14 Sekunden Flug wäre unsinnig, 14 Minuten plausibel
    expect(leseDauer('14')).toBe(840);
    expect(leseDauer('840')).toBe(840);
  });
});

describe('Datum', () => {
  it('liest ISO eindeutig', () => {
    const r = leseDatum('2026-07-19 14:30');
    expect(r.datum).toBe('2026-07-19');
    expect(r.zeit).toBe('14:30');
    expect(r.mehrdeutig).toBe(false);
  });

  it('liest deutsches Punktformat als Tag.Monat', () => {
    const r = leseDatum('03.04.2026');
    expect(r.datum).toBe('2026-04-03');
    expect(r.mehrdeutig).toBe(false);
  });

  it('löst Schrägstrich-Datum auf, wenn eine Zahl > 12 ist', () => {
    expect(leseDatum('19/07/2026').datum).toBe('2026-07-19');
    expect(leseDatum('19/07/2026').mehrdeutig).toBe(false);
    expect(leseDatum('07/19/2026').datum).toBe('2026-07-19');
  });

  it('markiert echte Mehrdeutigkeit, statt still zu raten', () => {
    const r = leseDatum('03/04/2026');
    expect(r.mehrdeutig).toBe(true);
    expect(r.datum).toBe('2026-03-04'); // US-Annahme, aber gekennzeichnet
  });
});

describe('Dublettenprüfung', () => {
  const vorhanden = [
    { id: 'f1', date: '2026-07-19', startTime: '14:30' },
    { id: 'f2', date: '2026-07-19', startTime: '17:05' },
  ] as Flight[];

  it('erkennt denselben Flug trotz kleiner Zeitabweichung', () => {
    expect(istDublette({ date: '2026-07-19', startTime: '14:32' }, vorhanden)?.id).toBe('f1');
  });

  it('hält zwei Flüge am selben Tag auseinander', () => {
    expect(istDublette({ date: '2026-07-19', startTime: '17:04' }, vorhanden)?.id).toBe('f2');
  });

  it('meldet keine Dublette an einem anderen Tag', () => {
    expect(istDublette({ date: '2026-07-20', startTime: '14:30' }, vorhanden)).toBeUndefined();
  });
});

describe('Gesamtvorschau', () => {
  const csv = [
    'Date,Duration (min),Latitude,Longitude,Location,Max Height (ft),Battery Start,Battery End',
    '2026-07-19 14:30,14,49.8728,8.6512,"Darmstadt, Hessen",328,98,42',
    '2026-07-20 09:15,22,49.8730,8.6520,Griesheim,164,100,55',
  ].join('\n');

  it('erzeugt einen Kandidaten je Datenzeile', () => {
    const v = baueVorschau(csv);
    expect(v.fehler).toHaveLength(0);
    expect(v.kandidaten).toHaveLength(2);
  });

  it('füllt die Felder korrekt und rechnet Einheiten um', () => {
    const [erster] = baueVorschau(csv).kandidaten;
    expect(erster.flug.date).toBe('2026-07-19');
    expect(erster.flug.startTime).toBe('14:30');
    expect(erster.flug.duration).toBe(14);
    expect(erster.flug.coordinates).toEqual([49.8728, 8.6512]);
    expect(erster.flug.locationName).toBe('Darmstadt, Hessen');
    expect(erster.flug.batteryStatus?.startPercent).toBe(98);
    // 328 ft ~ 100 m, umgerechnet und separat abgelegt
    expect(erster.maxHoeheM).toBe(100);
  });

  it('markiert bereits vorhandene Flüge als Dublette', () => {
    const vorhanden = [{ id: 'alt1', date: '2026-07-19', startTime: '14:30' }] as Flight[];
    const v = baueVorschau(csv, vorhanden);
    expect(v.kandidaten[0].dubletteVon).toBe('alt1');
    expect(v.kandidaten[1].dubletteVon).toBeUndefined();
  });

  it('bricht mit klarer Meldung ab, wenn die Dauer-Spalte fehlt', () => {
    const ohneDauer = 'Date,Latitude\n2026-07-19,49.87';
    const v = baueVorschau(ohneDauer);
    expect(v.fehler.join(' ')).toMatch(/Flugdauer/);
    expect(v.kandidaten).toHaveLength(0);
  });

  it('meldet eine leere Datei, statt zu stolpern', () => {
    expect(baueVorschau('').fehler.join(' ')).toMatch(/keine auswertbaren Zeilen/);
  });
});

describe('Drohnen-Zuordnung', () => {
  const garage = [
    { id: 'd1', model: 'Mini 4 Pro', name: 'Kleine' },
    { id: 'd2', model: 'Air 3' },
  ] as Drone[];

  it('findet die Drohne trotz DJI-Präfix und Bindestrichen', () => {
    expect(passendeDrohne('DJI Mini 4 Pro', garage)?.id).toBe('d1');
    expect(passendeDrohne('Mini-4-Pro', garage)?.id).toBe('d1');
  });

  it('findet auch über den selbstvergebenen Namen', () => {
    expect(passendeDrohne('Kleine', garage)?.id).toBe('d1');
  });

  it('gibt undefined zurück, statt irgendeine Drohne zu raten', () => {
    expect(passendeDrohne('Autel EVO II', garage)).toBeUndefined();
    expect(passendeDrohne('', garage)).toBeUndefined();
    expect(passendeDrohne(undefined, garage)).toBeUndefined();
  });
});

describe('Endzeit', () => {
  it('addiert die Dauer auf die Startzeit', () => {
    expect(berechneEndzeit('14:30', 25)).toBe('14:55');
    expect(berechneEndzeit('14:45', 30)).toBe('15:15');
  });

  it('läuft korrekt über Mitternacht', () => {
    expect(berechneEndzeit('23:50', 20)).toBe('00:10');
  });

  it('liefert leeren String bei unlesbarer Startzeit', () => {
    expect(berechneEndzeit('', 20)).toBe('');
  });
});

describe('Umwandlung in einen Flug', () => {
  const csv = [
    'Date,Duration (min),Latitude,Longitude,Location,Max Height (ft),Aircraft',
    '2026-07-19 14:30,14,49.8728,8.6512,Darmstadt,328,DJI Mini 4 Pro',
  ].join('\n');

  it('erzeugt einen vollständigen Flug mit allen Pflichtfeldern', () => {
    const [k] = baueVorschau(csv).kandidaten;
    const flug = zuFlug(k, 'd1');
    expect(flug.id).toBeTruthy();
    expect(flug.droneId).toBe('d1');
    expect(flug.date).toBe('2026-07-19');
    expect(flug.startTime).toBe('14:30');
    expect(flug.endTime).toBe('14:44');
    expect(flug.duration).toBe(14);
    expect(flug.coordinates).toEqual([49.8728, 8.6512]);
    expect(flug.createdAt).toBeGreaterThan(0);
  });

  it('rettet Höhe und Distanz in die Notizen, statt sie zu verlieren', () => {
    const [k] = baueVorschau(csv).kandidaten;
    expect(zuFlug(k, 'd1').notes).toMatch(/100 m/);
  });

  it('setzt Koordinaten auf [0,0], wenn die CSV keine hatte', () => {
    const ohne = 'Date,Duration (min)\n2026-07-19 14:30,14';
    const [k] = baueVorschau(ohne).kandidaten;
    expect(zuFlug(k, 'd1').coordinates).toEqual([0, 0]);
  });
});
