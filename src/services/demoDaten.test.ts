import { describe, it, expect } from 'vitest';
import { erzeugeBeispieldaten, DEMO_PRAEFIX } from './demoDaten';
import { berechneStatistik } from './flightStats';

const JETZT = new Date('2026-10-20T12:00:00').getTime();

describe('erzeugeBeispieldaten', () => {
  const d = erzeugeBeispieldaten(JETZT);
  const alle = [...d.drones, ...d.batteries, ...d.flights, ...d.maintenance, ...d.spareParts, ...d.locationFavorites];

  it('kennzeichnet jeden Eintrag mit demo-Präfix und eindeutiger ID', () => {
    expect(alle.every(x => x.id.startsWith(DEMO_PRAEFIX))).toBe(true);
    expect(new Set(alle.map(x => x.id)).size).toBe(alle.length);
  });

  it('verweist nur auf vorhandene Drohnen und Akkus', () => {
    const drohnen = new Set(d.drones.map(x => x.id));
    const akkus = new Set(d.batteries.map(x => x.id));
    expect(d.flights.every(f => drohnen.has(f.droneId) && (!f.batteryId || akkus.has(f.batteryId)))).toBe(true);
    expect(d.batteries.every(b => !b.droneId || drohnen.has(b.droneId))).toBe(true);
  });

  it('legt Flüge in die Vergangenheit, mehrere davon in die letzten 7 Tage', () => {
    const heute = new Date(JETZT).toISOString().slice(0, 10);
    expect(d.flights.every(f => f.date <= heute)).toBe(true);
    const vor7 = new Date(JETZT - 7 * 86400000).toISOString().slice(0, 10);
    expect(d.flights.filter(f => f.date >= vor7).length).toBeGreaterThanOrEqual(3);
  });

  it('füllt die Statistik sinnvoll', () => {
    const s = berechneStatistik(d.flights, d.drones);
    expect(s).toBeTruthy();
    expect(d.flights.reduce((sum, f) => sum + f.duration, 0)).toBeGreaterThan(300);
  });
});
