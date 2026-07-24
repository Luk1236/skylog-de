import { describe, it, expect } from 'vitest';
import { erzeugeRaster } from './gridPlan';
import { distanzMeter } from './flightTrack';
import type { Wegpunkt } from './db';

// Ein handliches Gebiet in Berlin, ~1 km Nord-Süd, gut für runde Zahlen.
const suedwest: Wegpunkt = { lat: 52.500, lon: 13.400 };
const nordost: Wegpunkt = { lat: 52.509, lon: 13.415 };

describe('erzeugeRaster – Grundform', () => {
  const r = erzeugeRaster(suedwest, nordost, { bahnabstandM: 100, richtung: 'ost-west' });

  it('liefert zwei Wegpunkte je Bahn', () => {
    expect(r.wegpunkte.length).toBe(r.bahnen * 2);
  });

  it('alle Wegpunkte liegen im aufgespannten Rechteck', () => {
    for (const w of r.wegpunkte) {
      expect(w.lat).toBeGreaterThanOrEqual(52.500 - 1e-9);
      expect(w.lat).toBeLessThanOrEqual(52.509 + 1e-9);
      expect(w.lon).toBeGreaterThanOrEqual(13.400 - 1e-9);
      expect(w.lon).toBeLessThanOrEqual(13.415 + 1e-9);
    }
  });

  it('spannt die Bahnen über die volle Ost-West-Breite', () => {
    // Erste Bahn: zwei Punkte gleicher Breite, volle Längen-Spanne.
    const [a, b] = r.wegpunkte;
    expect(a.lat).toBeCloseTo(b.lat, 9);
    const breiteM = distanzMeter(a.lat, a.lon, b.lat, b.lon);
    expect(breiteM).toBeGreaterThan(900); // ~1 km bei 13.400→13.415 auf 52.5°
  });

  it('Bahnabstand entspricht ungefähr der Vorgabe', () => {
    // Bahn 0 und Bahn 1 versetzen nur in Nord-Süd; in Ost-West starten sie
    // serpentinenbedingt auf verschiedenen Seiten. Also über die Breiten-
    // differenz messen, nicht über die Luftlinie der Startpunkte.
    const dLatMeter = Math.abs(r.wegpunkte[2].lat - r.wegpunkte[0].lat) * 111320;
    expect(dLatMeter).toBeGreaterThan(90);
    expect(dLatMeter).toBeLessThan(110);
  });
});

describe('erzeugeRaster – Serpentine', () => {
  it('kehrt jede zweite Bahn um (Zickzack, kein Rücksprung)', () => {
    const r = erzeugeRaster(suedwest, nordost, { bahnabstandM: 300, richtung: 'ost-west' });
    // Bahn 0 läuft in eine Richtung, Bahn 1 muss entgegengesetzt laufen:
    // das Ende von Bahn 0 und der Anfang von Bahn 1 liegen auf derselben Seite.
    const ende0 = r.wegpunkte[1];
    const anfang1 = r.wegpunkte[2];
    expect(ende0.lon).toBeCloseTo(anfang1.lon, 6);
  });
});

describe('erzeugeRaster – Richtung nord-sued', () => {
  it('versetzt die Bahnen nach Osten, Punkte im Rechteck', () => {
    const r = erzeugeRaster(suedwest, nordost, { bahnabstandM: 200, richtung: 'nord-sued' });
    expect(r.wegpunkte.length).toBe(r.bahnen * 2);
    // Erste Bahn: gleiche Länge, volle Breiten-Spanne.
    const [a, b] = r.wegpunkte;
    expect(a.lon).toBeCloseTo(b.lon, 9);
    expect(Math.abs(a.lat - b.lat)).toBeGreaterThan(0.008);
  });
});

describe('erzeugeRaster – Randfälle', () => {
  it('entartetes Gebiet (Linie) gibt nur die beiden Ecken', () => {
    const r = erzeugeRaster({ lat: 52.5, lon: 13.4 }, { lat: 52.5, lon: 13.42 }, {
      bahnabstandM: 50, richtung: 'ost-west',
    });
    expect(r.wegpunkte).toHaveLength(2);
    expect(r.bahnen).toBe(1);
  });

  it('begrenzt die Bahnenzahl und meldet das', () => {
    // 1 m Abstand über ~1 km ⇒ ohne Deckel ~1000 Bahnen.
    const r = erzeugeRaster(suedwest, nordost, {
      bahnabstandM: 1, richtung: 'ost-west', maxBahnen: 50,
    });
    expect(r.bahnen).toBe(50);
    expect(r.begrenzt).toBe(true);
    expect(r.wegpunkte).toHaveLength(100);
  });

  it('großer Abstand ergibt mindestens eine Bahn', () => {
    const r = erzeugeRaster(suedwest, nordost, { bahnabstandM: 100000, richtung: 'ost-west' });
    expect(r.bahnen).toBeGreaterThanOrEqual(1);
    expect(r.wegpunkte.length).toBeGreaterThanOrEqual(2);
  });
});

describe('erzeugeRaster – Startecke', () => {
  it('beginnt nahe dem zuerst übergebenen Punkt', () => {
    // Ecke1 im Nordosten ⇒ erste Bahn sollte im Norden liegen.
    const r = erzeugeRaster(nordost, suedwest, { bahnabstandM: 300, richtung: 'ost-west' });
    const ersteBahnLat = r.wegpunkte[0].lat;
    const letzteBahnLat = r.wegpunkte[r.wegpunkte.length - 1].lat;
    expect(ersteBahnLat).toBeGreaterThan(letzteBahnLat);
  });
});
