import { describe, it, expect } from 'vitest';
import { berechneStatistik, formatDauer } from './flightStats';
import type { Flight, Drone } from './db';

const drones = [
  { id: 'd1', model: 'Mini 4 Pro' },
  { id: 'd2', model: 'Air 3' },
] as Drone[];

function flug(over: Partial<Flight> = {}): Flight {
  return {
    id: Math.random().toString(36),
    droneId: 'd1',
    date: '2026-07-10',
    startTime: '14:00', endTime: '14:20',
    duration: 20,
    location: '', locationName: 'Darmstadt',
    coordinates: [49.87, 8.65],
    notes: '', createdAt: 0,
    ...over,
  };
}

const NOW = new Date('2026-07-20T12:00:00');

describe('formatDauer', () => {
  it('formatiert Stunden und Minuten', () => {
    expect(formatDauer(125)).toBe('2h 05m');
    expect(formatDauer(45)).toBe('45m');
    expect(formatDauer(0)).toBe('0m');
  });
});

describe('berechneStatistik', () => {
  it('summiert Flüge und Gesamtzeit', () => {
    const s = berechneStatistik([flug({ duration: 20 }), flug({ duration: 40 })], drones, NOW);
    expect(s.anzahlFluege).toBe(2);
    expect(s.gesamtMinuten).toBe(60);
    expect(s.schnittMinuten).toBe(30);
    expect(s.laengsterMinuten).toBe(40);
  });

  it('zählt Starts aus Legs, sonst einen pro Flug', () => {
    const mitLegs = flug({ legs: [
      { startTime: 0, endTime: 1, duration: 60 },
      { startTime: 2, endTime: 3, duration: 60 },
    ]});
    const ohne = flug();
    const s = berechneStatistik([mitLegs, ohne], drones, NOW);
    expect(s.starts).toBe(3); // 2 + 1
  });

  it('zählt aktive Tage eindeutig', () => {
    const s = berechneStatistik([
      flug({ date: '2026-07-10' }),
      flug({ date: '2026-07-10' }),
      flug({ date: '2026-07-11' }),
    ], drones, NOW);
    expect(s.aktiveTage).toBe(2);
  });

  it('trennt das laufende Jahr ab', () => {
    const s = berechneStatistik([
      flug({ date: '2026-03-01', duration: 30 }),
      flug({ date: '2025-12-01', duration: 99 }),
    ], drones, NOW);
    expect(s.diesesJahrFluege).toBe(1);
    expect(s.diesesJahrMinuten).toBe(30);
  });

  it('berechnet die Vorfall-Rate', () => {
    const s = berechneStatistik([
      flug({ incidents: 'Beinahe-Kollision' }),
      flug(),
      flug(),
      flug(),
    ], drones, NOW);
    expect(s.vorfallAnzahl).toBe(1);
    expect(s.vorfallRateProzent).toBe(25);
  });

  it('liefert immer 12 Monate, den Flug im richtigen einsortiert', () => {
    const s = berechneStatistik([flug({ date: '2026-07-10', duration: 20 })], drones, NOW);
    expect(s.proMonat).toHaveLength(12);
    const juli = s.proMonat.find(m => m.monat === '2026-07')!;
    expect(juli.fluege).toBe(1);
    expect(juli.minuten).toBe(20);
    // Der letzte Eintrag ist der aktuelle Monat
    expect(s.proMonat[11].monat).toBe('2026-07');
  });

  it('gruppiert Flugzeit je Drohne, absteigend', () => {
    const s = berechneStatistik([
      flug({ droneId: 'd1', duration: 10 }),
      flug({ droneId: 'd2', duration: 50 }),
      flug({ droneId: 'd2', duration: 20 }),
    ], drones, NOW);
    expect(s.proDrohne[0].model).toBe('Air 3');   // 70 min
    expect(s.proDrohne[0].minuten).toBe(70);
    expect(s.proDrohne[1].model).toBe('Mini 4 Pro');
  });

  it('nennt gelöschte Drohnen beim Namen', () => {
    const s = berechneStatistik([flug({ droneId: 'weg' })], drones, NOW);
    expect(s.proDrohne[0].model).toBe('Gelöschte Drohne');
  });

  it('ermittelt die Top-Standorte', () => {
    const s = berechneStatistik([
      flug({ locationName: 'Darmstadt' }),
      flug({ locationName: 'Darmstadt' }),
      flug({ locationName: 'Griesheim' }),
    ], drones, NOW);
    expect(s.topOrte[0]).toEqual({ ort: 'Darmstadt', anzahl: 2 });
    expect(s.topOrte[1]).toEqual({ ort: 'Griesheim', anzahl: 1 });
  });

  it('kommt mit null Flügen zurecht', () => {
    const s = berechneStatistik([], drones, NOW);
    expect(s.anzahlFluege).toBe(0);
    expect(s.schnittMinuten).toBe(0);
    expect(s.vorfallRateProzent).toBe(0);
    expect(s.proMonat).toHaveLength(12);
  });
});
