import { describe, it, expect } from 'vitest';
import { baueBehoerdenCheck } from './authorityCheck';
import type { UserProfile, Drone } from './db';

const JETZT = new Date('2026-07-20T12:00:00Z').getTime();

function profil(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'main_profile',
    name: 'Lukas Bootz',
    eid: 'DEU-OP-1234567',
    licenseType: 'A2',
    licenseExpiry: new Date('2030-01-01').toISOString(),
    insuranceNumber: 'V-987',
    ...over,
  };
}

function drohne(over: Partial<Drone> = {}): Drone {
  return { id: 'd1', model: 'Mini 4 Pro', uasClass: 'C0', weight: 249, eId: 'DEU-DR-abc', createdAt: 0, ...over } as Drone;
}

describe('baueBehoerdenCheck', () => {
  it('führt die Betreiber-ID als ersten Punkt', () => {
    const c = baueBehoerdenCheck(profil(), null, JETZT);
    expect(c.zeilen[0].label).toContain('Betreiber-ID');
    expect(c.zeilen[0].wert).toBe('DEU-OP-1234567');
    expect(c.zeilen[0].problem).toBeFalsy();
  });

  it('warnt und markiert, wenn die Betreiber-ID fehlt', () => {
    const c = baueBehoerdenCheck(profil({ eid: '' }), null, JETZT);
    expect(c.zeilen[0].problem).toBe(true);
    expect(c.warnungen.join(' ')).toMatch(/Betreiber-ID/);
  });

  it('erkennt einen abgelaufenen Kompetenznachweis', () => {
    const c = baueBehoerdenCheck(profil({ licenseExpiry: new Date('2020-01-01').toISOString() }), null, JETZT);
    const zeile = c.zeilen.find(z => z.label === 'Kompetenznachweis')!;
    expect(zeile.problem).toBe(true);
    expect(c.warnungen.join(' ')).toMatch(/abgelaufen/);
  });

  it('akzeptiert einen gültigen Nachweis ohne Warnung', () => {
    const c = baueBehoerdenCheck(profil(), null, JETZT);
    expect(c.warnungen).toHaveLength(0);
  });

  it('warnt bei fehlender Versicherung', () => {
    const c = baueBehoerdenCheck(profil({ insuranceNumber: '' }), null, JETZT);
    expect(c.warnungen.join(' ')).toMatch(/Haftpflicht|Versicherung/);
  });

  it('nimmt die Drohnendaten und ihre Kennung mit auf', () => {
    const c = baueBehoerdenCheck(profil(), drohne(), JETZT);
    expect(c.zeilen.some(z => z.wert.includes('Mini 4 Pro'))).toBe(true);
    expect(c.zeilen.find(z => z.label === 'Drohnen-Kennung')?.wert).toBe('DEU-DR-abc');
  });

  it('fällt bei fehlender e-ID der Drohne auf die Seriennummer zurück', () => {
    const c = baueBehoerdenCheck(profil(), drohne({ eId: '', serialNumber: 'SN-42' }), JETZT);
    expect(c.zeilen.find(z => z.label === 'Drohnen-Kennung')?.wert).toBe('SN-42');
  });

  it('kodiert Betreiber-ID und Nachweis in den QR-Inhalt', () => {
    const c = baueBehoerdenCheck(profil(), drohne(), JETZT);
    expect(c.qrInhalt).toContain('DEU-OP-1234567');
    expect(c.qrInhalt).toContain('A2');
    expect(c.qrInhalt).toContain('Mini 4 Pro');
  });

  it('kommt ohne Profil zurecht (alles als Problem)', () => {
    const c = baueBehoerdenCheck(null, null, JETZT);
    expect(c.zeilen[0].problem).toBe(true);
    expect(c.warnungen.length).toBeGreaterThan(0);
  });
});
