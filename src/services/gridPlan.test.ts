import { describe, it, expect } from 'vitest';
import { erzeugeRaster, erzeugeVieleckRaster, bahnabstandAusKamera } from './gridPlan';
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

describe('erzeugeVieleckRaster', () => {
  // Rechteck ~ 200 m (Ost-West) x 100 m (Nord-Süd) bei Darmstadt
  const lat = 49.87;
  const mLat = 1 / 111320;
  const mLon = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
  const ecke = (ostM: number, nordM: number) => ({ lat: lat + nordM * mLat, lon: 8.65 + ostM * mLon });
  const rechteck = [ecke(0, 0), ecke(200, 0), ecke(200, 100), ecke(0, 100)];

  const innen = (p: { lat: number; lon: number }, poly: { lat: number; lon: number }[], tol = 1e-7) => {
    let drin = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.lat > p.lat) !== (b.lat > p.lat)
        && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon + tol) drin = !drin;
    }
    return drin;
  };

  it('legt Ost-West-Bahnen (90°) mit dem gewünschten Abstand in ein Rechteck', () => {
    const r = erzeugeVieleckRaster(rechteck, { bahnabstandM: 25, richtungGrad: 90, hoeheM: 60 });
    expect(r.bahnen).toBe(4);              // 100 m / 25 m
    expect(r.wegpunkte).toHaveLength(8);
    // Bahnen laufen ost-west: beide Punkte einer Bahn haben dieselbe Breite
    for (let i = 0; i < r.wegpunkte.length; i += 2) {
      expect(r.wegpunkte[i].lat).toBeCloseTo(r.wegpunkte[i + 1].lat, 9);
    }
    // Abstand zwischen Bahn 1 und 2 ≈ 25 m
    expect((r.wegpunkte[2].lat - r.wegpunkte[0].lat) / mLat).toBeCloseTo(25, 3);
    expect(r.wegpunkte.every(w => w.alt === 60)).toBe(true);
  });

  it('beginnt an der zuerst gesetzten Ecke', () => {
    const r = erzeugeVieleckRaster([ecke(200, 100), ecke(0, 100), ecke(0, 0), ecke(200, 0)], { bahnabstandM: 25, richtungGrad: 90 });
    const erster = r.wegpunkte[0];
    expect(erster.lat).toBeGreaterThan(lat + 80 * mLat);   // oben
    expect(erster.lon).toBeGreaterThan(8.65 + 190 * mLon); // rechts
  });

  it('hält alle Punkte eines Dreiecks innerhalb der Fläche, auch schräg (37°)', () => {
    const dreieck = [ecke(0, 0), ecke(300, 0), ecke(150, 250)];
    const r = erzeugeVieleckRaster(dreieck, { bahnabstandM: 20, richtungGrad: 37 });
    expect(r.bahnen).toBeGreaterThan(5);
    // Punkte liegen auf dem Rand - minimal nach innen ziehen und prüfen
    const mitte = { lat: dreieck.reduce((s, e) => s + e.lat, 0) / 3, lon: dreieck.reduce((s, e) => s + e.lon, 0) / 3 };
    for (const w of r.wegpunkte) {
      const p = { lat: w.lat + (mitte.lat - w.lat) * 0.001, lon: w.lon + (mitte.lon - w.lon) * 0.001 };
      expect(innen(p, dreieck)).toBe(true);
    }
  });

  it('vergrößert den Abstand, wenn zu viele Bahnen entstünden', () => {
    const r = erzeugeVieleckRaster(rechteck, { bahnabstandM: 1, richtungGrad: 0, maxBahnen: 10 });
    expect(r.begrenzt).toBe(true);
    expect(r.bahnen).toBe(10);
  });

  it('fällt bei zwei Ecken auf das Rechteck-Raster zurück', () => {
    const r = erzeugeVieleckRaster([ecke(0, 0), ecke(200, 100)], { bahnabstandM: 50, richtungGrad: 90, hoeheM: 40 });
    expect(r.bahnen).toBe(3);
    expect(r.wegpunkte[0].alt).toBe(40);
  });
});

describe('bahnabstandAusKamera', () => {
  it('rechnet aus Höhe, Bildwinkel und Überlappung', () => {
    // 100 m Höhe, 90° FOV -> 200 m Bildbreite; 70 % Überlappung -> 60 m
    expect(bahnabstandAusKamera(100, 90, 70)).toBe(60);
    expect(bahnabstandAusKamera(50, 82, 80)).toBe(17);
  });
});
