// Design-Wächter: Regeln aus DESIGN.md, die sich am Quelltext prüfen lassen.
// Großschrift und schwerer Fettdruck waren schon zweimal ein Befund (163 bzw.
// 120 Stellen, viele kleine Labels in Versalien lasen sich schwer).
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function tsxDateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap(e => {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) return tsxDateien(pfad);
    return e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx') ? [pfad] : [];
  });
}

const zeilen = tsxDateien(SRC).flatMap(datei =>
  readFileSync(datei, 'utf8').split('\n').map((text, i) => ({ ort: `${datei.slice(SRC.length)}:${i + 1}`, text })));

const mit = (muster: RegExp) => zeilen.filter(z => muster.test(z.text));

describe('Typografie (DESIGN.md)', () => {
  it('nutzt Großschrift nur im Eyebrow-/Abzeichen-Stil (text-2xs, tracking-wider)', () => {
    const verstoesse = mit(/\buppercase\b/).filter(z => !/\btext-2xs\b/.test(z.text) || !/\btracking-wider\b/.test(z.text));
    expect(verstoesse.map(z => z.ort)).toEqual([]);
  });

  it('bleibt bei Großschrift unter der Obergrenze', () => {
    // Vorher 163, nach Runde 1 noch 73, jetzt nur Abschnittsüberschriften und Abzeichen.
    expect(mit(/\buppercase\b/).length).toBeLessThanOrEqual(25);
  });

  it('setzt font-black nie für kleine Schrift (Titel und große Zahlen)', () => {
    const verstoesse = mit(/\bfont-black\b/).filter(z => /\btext-(2xs|xs)\b/.test(z.text));
    expect(verstoesse.map(z => z.ort)).toEqual([]);
  });
});
