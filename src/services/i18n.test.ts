// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { uebersetze, ladeSprache, setzeSprache, andereSprache, TEXTE } from './i18n';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
});

describe('uebersetze', () => {
  it('liefert die deutsche Fassung', () => {
    expect(uebersetze('nav.logbuch', 'de')).toBe('Logbuch');
  });
  it('liefert die englische Fassung', () => {
    expect(uebersetze('nav.logbuch', 'en')).toBe('Logbook');
  });
  it('gibt bei unbekanntem Schlüssel den Schlüssel zurück, damit Lücken auffallen', () => {
    expect(uebersetze('gibt.es.nicht', 'en')).toBe('gibt.es.nicht');
  });
});

describe('Vollständigkeit des Wörterbuchs', () => {
  it('jeder Eintrag hat beide Sprachen ohne Leerstring', () => {
    const luecken = Object.entries(TEXTE).filter(
      ([, v]) => !v.de?.trim() || !v.en?.trim()
    );
    expect(luecken).toEqual([]);
  });

  // Grund für diesen Test: Es lagen acht Schlüssel im Wörterbuch, die nirgends
  // gerendert wurden — die Oberfläche blieb deutsch, obwohl die Übersetzung da
  // war. Der Fehler war unsichtbar, weil ein unbenutzter Eintrag nichts kaputt
  // macht. Dieser Test macht ihn sichtbar.
  it('jeder Schlüssel wird auch irgendwo per t() benutzt', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    const dateien: string[] = [];
    const sammle = (verzeichnis: string) => {
      for (const eintrag of readdirSync(verzeichnis)) {
        const pfad = join(verzeichnis, eintrag);
        if (statSync(pfad).isDirectory()) sammle(pfad);
        // i18n.ts selbst ausschliessen: dort steht jeder Schluessel als
        // Definition, sonst faende sich jeder Schluessel immer selbst.
        else if (/\.tsx?$/.test(eintrag) && !/\.test\.tsx?$/.test(eintrag) && eintrag !== 'i18n.ts') {
          dateien.push(pfad);
        }
      }
    };
    sammle('src');

    const quelltext = dateien.map(d => readFileSync(d, 'utf8')).join('\n');
    const unbenutzt = Object.keys(TEXTE).filter(k => !quelltext.includes(`'${k}'`));
    expect(unbenutzt).toEqual([]);
  });
});

describe('setzeSprache', () => {
  it('speichert und setzt lang am <html>', () => {
    setzeSprache('en');
    expect(localStorage.getItem('skylog_sprache')).toBe('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });
});

describe('ladeSprache', () => {
  it('liest die gespeicherte Sprache', () => {
    localStorage.setItem('skylog_sprache', 'en');
    expect(ladeSprache()).toBe('en');
  });
  it('ignoriert Unsinn und liefert eine gültige Sprache', () => {
    localStorage.setItem('skylog_sprache', 'klingonisch');
    expect(['de', 'en']).toContain(ladeSprache());
  });
});

describe('andereSprache', () => {
  it('kippt zwischen de und en', () => {
    expect(andereSprache('de')).toBe('en');
    expect(andereSprache('en')).toBe('de');
  });
});
