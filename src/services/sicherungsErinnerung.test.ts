import { describe, it, expect, beforeEach } from 'vitest';
import { getSicherungsIntervall, setSicherungsIntervall, STANDARD_INTERVALL } from './sicherungsErinnerung';

const mockStorage: Record<string, string> = {};
const fakeLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = fakeLocalStorage;
}

describe('sicherungsErinnerung', () => {
  beforeEach(() => localStorage.clear());

  it('liefert ohne Einstellung den Standard', () => {
    expect(getSicherungsIntervall()).toBe(STANDARD_INTERVALL);
  });

  it('speichert erlaubte Intervalle und ignoriert andere', () => {
    setSicherungsIntervall(14);
    expect(getSicherungsIntervall()).toBe(14);
    setSicherungsIntervall(5);
    expect(getSicherungsIntervall()).toBe(14);
  });
});
