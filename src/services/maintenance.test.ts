import { describe, it, expect } from 'vitest';
import {
  flugStundenGesamt, letzteWartung, gesamtKosten, garantieStatus, wartungStatus,
} from './maintenance';
import type { Drone, Flight, MaintenanceRecord } from './db';

const DAY = 86400000;
const NOW = new Date('2026-07-20T12:00:00').getTime();

function drohne(over: Partial<Drone> = {}): Drone {
  return { id: 'd1', model: 'Mini 4 Pro', weight: 249, uasClass: 'C0', eId: 'x', createdAt: NOW - 400 * DAY, ...over } as Drone;
}
function flug(over: Partial<Flight> = {}): Flight {
  return { id: Math.random().toString(36), droneId: 'd1', date: '2026-07-01', startTime: '', endTime: '', duration: 60, location: '', locationName: '', coordinates: [0, 0], notes: '', createdAt: 0, ...over } as Flight;
}
function wartung(over: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return { id: Math.random().toString(36), droneId: 'd1', date: '2026-01-01', type: 'General', description: '', createdAt: 0, ...over } as MaintenanceRecord;
}

describe('flugStundenGesamt', () => {
  it('summiert nur die Minuten der Drohne und rechnet in Stunden', () => {
    const f = [flug({ duration: 90 }), flug({ duration: 30 }), flug({ droneId: 'andere', duration: 600 })];
    expect(flugStundenGesamt(f, 'd1')).toBe(2); // 120 min
  });
});

describe('letzteWartung', () => {
  it('liefert den jüngsten Eintrag', () => {
    const r = [wartung({ date: '2026-01-01' }), wartung({ date: '2026-06-01' }), wartung({ date: '2026-03-01' })];
    expect(letzteWartung(r, 'd1')?.date).toBe('2026-06-01');
  });
  it('ist null ohne Eintrag', () => {
    expect(letzteWartung([], 'd1')).toBeNull();
  });
});

describe('gesamtKosten', () => {
  it('summiert die Kosten der Drohne', () => {
    const r = [wartung({ cost: 49.9 }), wartung({ cost: 120 }), wartung({ droneId: 'x', cost: 999 })];
    expect(gesamtKosten(r, 'd1')).toBeCloseTo(169.9);
  });
});

describe('garantieStatus', () => {
  it('meldet keine Garantie ohne Datum', () => {
    expect(garantieStatus(drohne(), NOW).status).toBe('keine');
  });
  it('erkennt aktive Garantie', () => {
    expect(garantieStatus(drohne({ warrantyUntil: new Date(NOW + 200 * DAY).toISOString() }), NOW).status).toBe('aktiv');
  });
  it('warnt bei baldigem Ablauf (≤30 Tage)', () => {
    expect(garantieStatus(drohne({ warrantyUntil: new Date(NOW + 10 * DAY).toISOString() }), NOW).status).toBe('bald');
  });
  it('erkennt abgelaufene Garantie', () => {
    const g = garantieStatus(drohne({ warrantyUntil: new Date(NOW - 5 * DAY).toISOString() }), NOW);
    expect(g.status).toBe('abgelaufen');
    expect(g.tage).toBeLessThan(0);
  });
});

describe('wartungStatus', () => {
  it('gibt kein Urteil ohne konfiguriertes Intervall', () => {
    expect(wartungStatus(drohne(), [], [], NOW).level).toBe('ok');
  });

  it('schlägt bei überschrittenem Kalenderintervall Alarm', () => {
    const d = drohne({ maintenanceIntervalDays: 180 });
    const r = [wartung({ date: new Date(NOW - 200 * DAY).toISOString().slice(0, 10) })];
    const s = wartungStatus(d, [], r, NOW);
    expect(s.level).toBe('alert');
    expect(s.gruende.join(' ')).toMatch(/Kalender-Wartung überfällig/);
  });

  it('warnt kurz vor dem Kalenderintervall', () => {
    const d = drohne({ maintenanceIntervalDays: 100 });
    const r = [wartung({ date: new Date(NOW - 95 * DAY).toISOString().slice(0, 10) })];
    expect(wartungStatus(d, [], r, NOW).level).toBe('warn');
  });

  it('schlägt beim Stundenintervall Alarm', () => {
    const d = drohne({ maintenanceIntervalHours: 20 });
    const f = Array.from({ length: 25 }, () => flug({ duration: 60 })); // 25 h
    const s = wartungStatus(d, f, [], NOW);
    expect(s.level).toBe('alert');
    expect(s.stundenSeitLetzter).toBe(25);
  });

  it('rechnet die Stunden ab der letzten Wartung', () => {
    const d = drohne({ maintenanceIntervalHours: 20 });
    const f = Array.from({ length: 30 }, () => flug({ duration: 60 })); // 30 h gesamt
    const r = [wartung({ hoursAtMaintenance: 25, date: '2026-07-01' })];
    const s = wartungStatus(d, f, r, NOW);
    expect(s.stundenSeitLetzter).toBe(5); // 30 - 25, unter Grenze 20
    expect(s.level).toBe('ok');
  });

  it('nutzt das Kaufdatum, wenn noch nie gewartet wurde', () => {
    const d = drohne({ maintenanceIntervalDays: 90, purchaseDate: new Date(NOW - 120 * DAY).toISOString() });
    expect(wartungStatus(d, [], [], NOW).level).toBe('alert');
  });
});
