import { describe, it, expect } from 'vitest';
import {
  lonLatZuKachel, kachelanzahlAufZoom, kachelnImGebiet, schaetzeGroesseBytes, formatBytes,
  type BBox,
} from './offlineMap';

// Ein bekanntes Referenzbeispiel: Berlin-Mitte auf Zoom 14.
// Nach der Standard-Slippy-Map-Formel ist das Kachel x=8802, y=5373.
describe('lonLatZuKachel', () => {
  it('rechnet Berlin auf z14 korrekt um', () => {
    const k = lonLatZuKachel(13.4, 52.52, 14);
    expect(k.x).toBe(8801);
    expect(k.y).toBe(5373);
  });

  it('Nullmeridian/Äquator liegt in der Mitte des Gitters', () => {
    const k = lonLatZuKachel(0, 0, 1);
    expect(k.x).toBe(1);
    expect(k.y).toBe(1);
  });

  it('beschneidet extreme Breiten statt NaN zu liefern', () => {
    const k = lonLatZuKachel(0, 89, 3);
    expect(Number.isFinite(k.x)).toBe(true);
    expect(Number.isFinite(k.y)).toBe(true);
    expect(k.y).toBeGreaterThanOrEqual(0);
  });
});

const berlin: BBox = { minLon: 13.35, minLat: 52.48, maxLon: 13.45, maxLat: 52.55 };

describe('kachelanzahlAufZoom', () => {
  it('niedriger Zoom = wenige Kacheln, höher = mehr', () => {
    const grob = kachelanzahlAufZoom(berlin, 10);
    const fein = kachelanzahlAufZoom(berlin, 15);
    expect(grob).toBeGreaterThanOrEqual(1);
    expect(fein).toBeGreaterThan(grob);
  });

  it('ein winziges Gebiet ist mindestens eine Kachel', () => {
    const punkt: BBox = { minLon: 13.4, minLat: 52.52, maxLon: 13.4001, maxLat: 52.5201 };
    expect(kachelanzahlAufZoom(punkt, 12)).toBeGreaterThanOrEqual(1);
  });
});

describe('kachelnImGebiet', () => {
  it('sammelt Kacheln über den ganzen Zoombereich', () => {
    const plan = kachelnImGebiet(berlin, 12, 14);
    expect(plan.kacheln.length).toBeGreaterThan(0);
    expect(plan.maxZoom).toBe(14);
    expect(plan.begrenzt).toBe(false);
    // Alle Zoomstufen vertreten.
    const zooms = new Set(plan.kacheln.map(k => k.z));
    expect(zooms).toEqual(new Set([12, 13, 14]));
  });

  it('die Summe entspricht der Kachelanzahl je Zoom', () => {
    const plan = kachelnImGebiet(berlin, 12, 14);
    const erwartet = kachelanzahlAufZoom(berlin, 12)
      + kachelanzahlAufZoom(berlin, 13)
      + kachelanzahlAufZoom(berlin, 14);
    expect(plan.kacheln.length).toBe(erwartet);
  });

  it('deckelt die Gesamtzahl und bricht vor der zu großen Stufe ab', () => {
    // Sehr großes Gebiet + hoher Zoom + kleiner Deckel ⇒ begrenzt.
    const gross: BBox = { minLon: 5, minLat: 47, maxLon: 15, maxLat: 55 };
    const plan = kachelnImGebiet(gross, 6, 16, 500);
    expect(plan.begrenzt).toBe(true);
    expect(plan.kacheln.length).toBeLessThanOrEqual(500);
    expect(plan.maxZoom).toBeLessThan(16);
  });

  it('keine doppelten Kacheln', () => {
    const plan = kachelnImGebiet(berlin, 12, 14);
    const schluessel = plan.kacheln.map(k => `${k.z}/${k.x}/${k.y}`);
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });
});

describe('schaetzeGroesseBytes / formatBytes', () => {
  it('skaliert linear mit der Kachelzahl', () => {
    expect(schaetzeGroesseBytes(100)).toBe(100 * 25000);
  });
  it('formatiert kB und MB lesbar', () => {
    expect(formatBytes(840 * 1024)).toBe('840 kB');
    expect(formatBytes(12.3 * 1024 * 1024)).toBe('12,3 MB');
  });
});
