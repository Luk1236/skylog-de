import { describe, it, expect } from 'vitest';
import { DEUTSCHLAND_QUELLEN, EU_QUELLEN, RECHTSGRUNDLAGEN } from './behoerden';

const alle = [...DEUTSCHLAND_QUELLEN, ...EU_QUELLEN, ...RECHTSGRUNDLAGEN];

describe('behoerden-Verzeichnis', () => {
  it('enthält Einträge in jeder Gruppe', () => {
    expect(DEUTSCHLAND_QUELLEN.length).toBeGreaterThan(0);
    expect(EU_QUELLEN.length).toBeGreaterThan(0);
    expect(RECHTSGRUNDLAGEN.length).toBeGreaterThan(0);
  });

  it('jeder Eintrag hat Name, Beschreibung und eine https-URL', () => {
    for (const l of alle) {
      expect(l.name.trim()).not.toBe('');
      expect(l.beschreibung.trim()).not.toBe('');
      expect(l.url).toMatch(/^https:\/\//);
    }
  });

  it('hat keine doppelten URLs', () => {
    const urls = alle.map(l => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
