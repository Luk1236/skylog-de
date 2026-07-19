import { describe, it, expect } from 'vitest';
import { getReminders } from './reminders';
import type { Drone, Battery, UserProfile } from './db';

// Fester Bezugszeitpunkt, damit die Tests nicht von der Uhr abhängen.
const JETZT = new Date('2026-07-19T12:00:00Z').getTime();
const TAG = 1000 * 60 * 60 * 24;

function profil(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'main_profile',
    name: 'Testpilot',
    eid: 'DEU-eID-test',
    licenseType: 'A2',
    insuranceNumber: 'V-123',
    ...overrides,
  };
}

function drohne(overrides: Partial<Drone> = {}): Drone {
  return { id: 'd1', name: 'Testdrohne', model: 'Mini 4', ...overrides } as Drone;
}

function akku(overrides: Partial<Battery> = {}): Battery {
  return { id: 'b1', number: 1, ...overrides } as Battery;
}

describe('Fernpilotenzeugnis', () => {
  it('meldet Alarm, wenn die Lizenz abgelaufen ist', () => {
    const r = getReminders(
      profil({ licenseExpiry: new Date(JETZT - 5 * TAG).toISOString() }),
      [], [], JETZT, JETZT
    );
    const treffer = r.find(x => x.text.includes('Fernpilotenzeugnis'));
    expect(treffer?.level).toBe('alert');
    expect(treffer?.text).toContain('abgelaufen');
  });

  it('warnt 30 Tage vorher, aber nicht früher', () => {
    const in20Tagen = getReminders(
      profil({ licenseExpiry: new Date(JETZT + 20 * TAG).toISOString() }),
      [], [], JETZT, JETZT
    );
    expect(in20Tagen.find(x => x.text.includes('Fernpilotenzeugnis'))?.level).toBe('warn');

    const in90Tagen = getReminders(
      profil({ licenseExpiry: new Date(JETZT + 90 * TAG).toISOString() }),
      [], [], JETZT, JETZT
    );
    expect(in90Tagen.find(x => x.text.includes('Fernpilotenzeugnis'))).toBeUndefined();
  });
});

describe('Akkus', () => {
  it('schlägt bei schlechter Gesundheit Alarm', () => {
    const r = getReminders(profil(), [], [akku({ health: 45 })], JETZT, JETZT);
    expect(r.find(x => x.text.includes('Gesundheit'))?.level).toBe('alert');
  });

  it('ignoriert health = 0 (nicht gemessen) statt es als defekt zu werten', () => {
    const r = getReminders(profil(), [], [akku({ health: 0 })], JETZT, JETZT);
    expect(r.find(x => x.text.includes('Gesundheit'))).toBeUndefined();
  });

  it('warnt ab 200 Ladezyklen', () => {
    const r = getReminders(profil(), [], [akku({ cycles: 250 })], JETZT, JETZT);
    expect(r.find(x => x.text.includes('Ladezyklen'))?.level).toBe('warn');
  });
});

describe('Versicherung', () => {
  it('warnt, wenn keine Versicherungsnummer hinterlegt ist', () => {
    const r = getReminders(profil({ insuranceNumber: '' }), [], [], JETZT, JETZT);
    expect(r.find(x => x.text.includes('Haftpflicht'))?.level).toBe('warn');
  });
});

describe('Datensicherung', () => {
  it('sagt nichts, solange gar keine Daten da sind', () => {
    const r = getReminders(profil(), [], [], null, JETZT);
    expect(r.find(x => x.text.includes('sicher'))).toBeUndefined();
  });

  it('warnt, wenn Daten da sind aber noch nie gesichert wurde', () => {
    const r = getReminders(profil(), [drohne()], [], null, JETZT);
    expect(r.find(x => x.text.includes('Noch nie gesichert'))?.level).toBe('warn');
  });

  it('eskaliert von warn auf alert zwischen 30 und 90 Tagen', () => {
    const vor40 = getReminders(profil(), [drohne()], [], JETZT - 40 * TAG, JETZT);
    expect(vor40.find(x => x.text.includes('Letzte Sicherung'))?.level).toBe('warn');

    const vor100 = getReminders(profil(), [drohne()], [], JETZT - 100 * TAG, JETZT);
    expect(vor100.find(x => x.text.includes('Letzte Sicherung'))?.level).toBe('alert');
  });

  it('schweigt bei frischer Sicherung', () => {
    const r = getReminders(profil(), [drohne()], [], JETZT - 3 * TAG, JETZT);
    expect(r.find(x => x.text.includes('Sicherung'))).toBeUndefined();
  });
});
