import { describe, it, expect, beforeEach } from 'vitest';
import { hashPin, setPin, removePin, isPinEnabled, verifyPin } from './pinProtection';

// Simple in-memory localStorage mock for node test environment
const mockStorage: Record<string, string> = {};
const fakeLocalStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = fakeLocalStorage;
}

describe('pinProtection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hashes 4-digit PINs correctly and rejects invalid PINs', () => {
    const h1 = hashPin('1234');
    expect(h1).toBeTruthy();
    expect(() => hashPin('123')).toThrow('4 Ziffern');
    expect(() => hashPin('abcd')).toThrow('4 Ziffern');
  });

  it('manages PIN lifecycle (set, verify, remove)', () => {
    expect(isPinEnabled()).toBe(false);
    expect(verifyPin('1234')).toBe(true); // Default true when disabled

    setPin('4321');
    expect(isPinEnabled()).toBe(true);
    expect(verifyPin('4321')).toBe(true);
    expect(verifyPin('1111')).toBe(false);

    removePin();
    expect(isPinEnabled()).toBe(false);
  });
});
