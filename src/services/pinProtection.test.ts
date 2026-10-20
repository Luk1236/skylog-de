import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPinV1, setPin, removePin, isPinEnabled, verifyPin, wartezeitMs, sperreRestSekunden,
} from './pinProtection';

// Simple in-memory localStorage mock for node test environment
const mockStorage: Record<string, string> = {};
const fakeLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = fakeLocalStorage;
}

// PBKDF2 mit 310.000 Runden ist absichtlich langsam - auf einem ausgelasteten
// Rechner/CI brauchen mehrere Pruefungen in einem Test mehr als 5 s.
describe('pinProtection', { timeout: 30_000 }, () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lehnt ungültige PINs beim Setzen ab', async () => {
    await expect(setPin('123')).rejects.toThrow('4 Ziffern');
    await expect(setPin('abcd')).rejects.toThrow('4 Ziffern');
  });

  it('setzt, prüft und entfernt eine PIN (PBKDF2, v2)', async () => {
    expect(isPinEnabled()).toBe(false);
    expect(await verifyPin('1234')).toEqual({ ok: true }); // ohne PIN immer offen

    await setPin('4321');
    expect(isPinEnabled()).toBe(true);
    const gespeichert = JSON.parse(localStorage.getItem('skylog_pin_hash_v2')!);
    expect(gespeichert).toMatchObject({ v: 2, iter: 310_000 });
    expect(JSON.stringify(gespeichert)).not.toContain('4321');

    expect((await verifyPin('4321')).ok).toBe(true);
    expect((await verifyPin('1111')).ok).toBe(false);

    removePin();
    expect(isPinEnabled()).toBe(false);
  });

  it('nutzt für gleiche PINs unterschiedliche Salze', async () => {
    await setPin('2468');
    const a = localStorage.getItem('skylog_pin_hash_v2');
    await setPin('2468');
    expect(localStorage.getItem('skylog_pin_hash_v2')).not.toBe(a);
  });

  it('stellt alte v1-PINs beim Entsperren auf v2 um', async () => {
    localStorage.setItem('skylog_pin_hash_v1', hashPinV1('9876'));
    localStorage.setItem('skylog_pin_enabled_v1', 'true');
    expect(isPinEnabled()).toBe(true);

    expect((await verifyPin('0000')).ok).toBe(false);
    expect(localStorage.getItem('skylog_pin_hash_v1')).not.toBeNull();

    expect((await verifyPin('9876')).ok).toBe(true);
    expect(localStorage.getItem('skylog_pin_hash_v1')).toBeNull();
    expect(localStorage.getItem('skylog_pin_hash_v2')).not.toBeNull();
    expect((await verifyPin('9876')).ok).toBe(true);
  });

  it('sperrt nach zu vielen Fehlversuchen mit wachsender Wartezeit', async () => {
    await setPin('1357');
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) expect(await verifyPin('0000', t)).toEqual({ ok: false, gesperrtSekunden: 0 });
    expect(await verifyPin('0000', t)).toEqual({ ok: false, gesperrtSekunden: 30 });
    // Während der Sperre wird nicht einmal die richtige PIN geprüft
    expect(await verifyPin('1357', t + 1000)).toEqual({ ok: false, gesperrtSekunden: 29 });
    expect(sperreRestSekunden(t + 1000)).toBe(29);
    // Danach geht die richtige PIN und setzt den Zähler zurück
    expect((await verifyPin('1357', t + 31_000)).ok).toBe(true);
    expect(sperreRestSekunden(t + 31_000)).toBe(0);
  });

  it('berechnet die Wartezeit gedeckelt', () => {
    expect(wartezeitMs(4)).toBe(0);
    expect(wartezeitMs(5)).toBe(30_000);
    expect(wartezeitMs(6)).toBe(60_000);
    expect(wartezeitMs(20)).toBe(15 * 60_000);
  });
});
