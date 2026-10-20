import { describe, it, expect } from 'vitest';
import { planeBenachrichtigungen, idFuer } from './benachrichtigungen';
import type { Drone, UserProfile } from './db';

const TAG = 24 * 60 * 60 * 1000;
const JETZT = new Date('2026-10-20T12:00:00').getTime();

const profil = (p: Partial<UserProfile> = {}): UserProfile => ({
  id: 'main_profile', name: 'Test', eid: 'DEU123', licenseType: 'A1/A3', insuranceNumber: 'V-1', ...p,
});
const drohne = (d: Partial<Drone> = {}): Drone => ({
  id: 'd1', model: 'Mini 4 Pro', weight: 249, uasClass: 'C0', eId: 'x', createdAt: 0, ...d,
} as Drone);

describe('planeBenachrichtigungen', () => {
  it('plant 30/7/0 Tage vor Lizenzablauf, nur in der Zukunft, um 9 Uhr', () => {
    const in20 = new Date(JETZT + 20 * TAG).toISOString().slice(0, 10);
    const r = planeBenachrichtigungen(profil({ licenseExpiry: in20 }), [], [], null, 30, JETZT);
    expect(r.map(b => b.titel)).toEqual(['Fernpilotenzeugnis läuft ab', 'Fernpilotenzeugnis abgelaufen']);
    expect(new Date(r[0].zeitpunkt).getHours()).toBe(9);
  });

  it('erinnert an Garantie-Ende und Wartung je Drohne', () => {
    const d = drohne({
      warrantyUntil: new Date(JETZT + 60 * TAG).toISOString(),
      lastMotorClean: JETZT - 10 * TAG,
      maintenanceIntervalDays: 30,
    });
    const r = planeBenachrichtigungen(profil(), [d], [], JETZT, 30, JETZT);
    const titel = r.map(b => b.titel);
    expect(titel).toContain('Garantie endet bald');
    expect(titel).toContain('Wartung fällig');
    const wartung = r.find(b => b.titel === 'Wartung fällig')!;
    expect(Math.round((wartung.zeitpunkt - JETZT) / TAG)).toBe(20);
  });

  it('plant die Sicherung nach dem Intervall, überfällig am nächsten Abend', () => {
    const d = drohne();
    const puenktlich = planeBenachrichtigungen(profil(), [d], [], JETZT - 5 * TAG, 14, JETZT)
      .find(b => b.titel === 'Datensicherung fällig')!;
    expect(Math.round((puenktlich.zeitpunkt - JETZT) / TAG)).toBe(9);
    expect(new Date(puenktlich.zeitpunkt).getHours()).toBe(18);

    const ueberfaellig = planeBenachrichtigungen(profil(), [d], [], JETZT - 50 * TAG, 14, JETZT)
      .find(b => b.titel === 'Datensicherung fällig')!;
    expect(ueberfaellig.zeitpunkt).toBe(new Date('2026-10-21T18:00:00').getTime());
  });

  it('erinnert ohne Daten nicht an eine Sicherung', () => {
    expect(planeBenachrichtigungen(profil(), [], [], null, 30, JETZT)).toEqual([]);
  });

  it('vergibt stabile, positive IDs', () => {
    expect(idFuer('lizenz-7')).toBe(idFuer('lizenz-7'));
    expect(idFuer('lizenz-7')).not.toBe(idFuer('lizenz-30'));
    expect(idFuer('x')).toBeGreaterThan(0);
  });
});
