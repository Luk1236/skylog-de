// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ladeStandortFreigabe, speichereStandortFreigabe, standortSchonFreigegeben } from './standortFreigabe';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Standort-Freigabe', () => {
  it('ist ohne gespeicherte Wahl offen', () => {
    expect(ladeStandortFreigabe()).toBe('offen');
  });

  it('merkt sich Erlauben und Ablehnen', () => {
    speichereStandortFreigabe('erlaubt');
    expect(ladeStandortFreigabe()).toBe('erlaubt');
    speichereStandortFreigabe('abgelehnt');
    expect(ladeStandortFreigabe()).toBe('abgelehnt');
  });

  it('ignoriert unbekannte Werte', () => {
    localStorage.setItem('skylog_standort_freigabe', 'vielleicht');
    expect(ladeStandortFreigabe()).toBe('offen');
  });

  it('erkennt eine schon erteilte Browser-Freigabe', async () => {
    vi.stubGlobal('navigator', { permissions: { query: async () => ({ state: 'granted' }) } });
    expect(await standortSchonFreigegeben()).toBe(true);
    vi.stubGlobal('navigator', { permissions: { query: async () => ({ state: 'prompt' }) } });
    expect(await standortSchonFreigegeben()).toBe(false);
  });

  it('kommt ohne Permissions-API aus', async () => {
    vi.stubGlobal('navigator', {});
    expect(await standortSchonFreigegeben()).toBe(false);
    vi.stubGlobal('navigator', { permissions: { query: async () => { throw new Error('nicht unterstützt'); } } });
    expect(await standortSchonFreigegeben()).toBe(false);
  });
});
