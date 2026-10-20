import { afterEach, describe, expect, it, vi } from 'vitest';
import { dauerhaftAnfordern, formatiereBytes, leseSpeicherStatus } from './speicherSchutz';

afterEach(() => vi.unstubAllGlobals());

describe('leseSpeicherStatus', () => {
  it('meldet dauerhaften Speicher und die Belegung', async () => {
    vi.stubGlobal('navigator', {
      storage: { persisted: async () => true, estimate: async () => ({ usage: 2048, quota: 1_000_000 }) },
    });
    expect(await leseSpeicherStatus()).toEqual({ dauerhaft: true, belegt: 2048, gesamt: 1_000_000 });
  });

  it('kommt ohne estimate aus', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => false } });
    expect(await leseSpeicherStatus()).toEqual({ dauerhaft: false, belegt: undefined, gesamt: undefined });
  });

  it('liefert null, wenn der Browser keine Storage-API hat oder sie wirft', async () => {
    vi.stubGlobal('navigator', {});
    expect(await leseSpeicherStatus()).toEqual({ dauerhaft: null });
    vi.stubGlobal('navigator', { storage: { persisted: async () => { throw new Error('gesperrt'); } } });
    expect(await leseSpeicherStatus()).toEqual({ dauerhaft: null });
  });
});

describe('dauerhaftAnfordern', () => {
  it('gibt die Antwort des Browsers weiter', async () => {
    vi.stubGlobal('navigator', { storage: { persist: async () => true } });
    expect(await dauerhaftAnfordern()).toBe(true);
  });

  it('liefert false ohne API oder bei Fehlern', async () => {
    vi.stubGlobal('navigator', {});
    expect(await dauerhaftAnfordern()).toBe(false);
    vi.stubGlobal('navigator', { storage: { persist: async () => { throw new Error('nein'); } } });
    expect(await dauerhaftAnfordern()).toBe(false);
  });
});

describe('formatiereBytes', () => {
  it('wählt die passende Einheit und das Zahlenformat der Sprache', () => {
    expect(formatiereBytes(0, 'de')).toBe('0 B');
    expect(formatiereBytes(1536, 'de')).toBe('1,5 KB');
    expect(formatiereBytes(1536, 'en')).toBe('1.5 KB');
    expect(formatiereBytes(12.3 * 1024 * 1024, 'de')).toBe('12 MB');
    expect(formatiereBytes(3 * 1024 ** 3, 'de')).toBe('3 GB');
  });
});
