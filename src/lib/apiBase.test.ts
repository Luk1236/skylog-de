import { describe, expect, it } from 'vitest';
import { apiUrl } from './apiBase';

describe('apiUrl', () => {
  it('nutzt im Browser ohne Basis den relativen Pfad', () => {
    expect(apiUrl('/api/safety-check', undefined, false)).toBe('/api/safety-check');
    expect(apiUrl('/api/safety-check', '', false)).toBe('/api/safety-check');
  });

  it('setzt die Basis davor und entfernt doppelte Schrägstriche', () => {
    expect(apiUrl('/api/safety-check', 'https://skylog.vercel.app/', true)).toBe('https://skylog.vercel.app/api/safety-check');
    expect(apiUrl('/api/safety-check', ' https://x.example ', false)).toBe('https://x.example/api/safety-check');
  });

  it('liefert nativ ohne Basis null statt eines toten localhost-Aufrufs', () => {
    expect(apiUrl('/api/safety-check', undefined, true)).toBeNull();
  });
});
