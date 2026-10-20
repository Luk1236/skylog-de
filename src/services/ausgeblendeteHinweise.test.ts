import { beforeEach, describe, expect, it } from 'vitest';
import { blendeAus, sichtbareHinweise } from './ausgeblendeteHinweise';

const TAG = 24 * 60 * 60 * 1000;
const JETZT = Date.UTC(2026, 9, 20);

describe('ausgeblendeteHinweise', () => {
  beforeEach(() => {
    const speicher = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => speicher.get(k) ?? null,
      setItem: (k: string, v: string) => { speicher.set(k, v); },
      removeItem: (k: string) => { speicher.delete(k); },
      clear: () => speicher.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  const liste = [{ schluessel: 'sicherung' }, { schluessel: 'lizenz' }];

  it('blendet einen Hinweis für 7 Tage aus', () => {
    blendeAus('sicherung', 7, JETZT);
    expect(sichtbareHinweise(liste, JETZT + TAG)).toEqual([{ schluessel: 'lizenz' }]);
    expect(sichtbareHinweise(liste, JETZT + 8 * TAG)).toEqual(liste);
  });

  it('zeigt alles, wenn der Speicher kaputt ist', () => {
    localStorage.setItem('skylog_ausgeblendete_hinweise', '{kaputt');
    expect(sichtbareHinweise(liste, JETZT)).toEqual(liste);
  });
});
