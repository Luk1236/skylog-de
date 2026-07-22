import { describe, it, expect } from 'vitest';
import {
  standardPunkte, punktHinzufuegen, punktEntfernen, punktBearbeiten, verschiebe,
  DEFAULT_PREFLIGHT, DEFAULT_POSTFLIGHT,
} from './checklists';

describe('standardPunkte', () => {
  it('liefert die Vorflug-Standardliste mit IDs', () => {
    const p = standardPunkte('preflight');
    expect(p).toHaveLength(DEFAULT_PREFLIGHT.length);
    expect(p[0].text).toBe(DEFAULT_PREFLIGHT[0]);
    expect(p[0].id).toBeTruthy();
  });
  it('liefert die Nachflug-Standardliste', () => {
    expect(standardPunkte('postflight')).toHaveLength(DEFAULT_POSTFLIGHT.length);
  });
  it('vergibt eindeutige IDs', () => {
    const p = standardPunkte('preflight');
    expect(new Set(p.map(x => x.id)).size).toBe(p.length);
  });
});

describe('punktHinzufuegen', () => {
  it('hängt einen Punkt an', () => {
    const l = punktHinzufuegen([], 'Neuer Punkt');
    expect(l).toHaveLength(1);
    expect(l[0].text).toBe('Neuer Punkt');
  });
  it('trimmt und ignoriert Leereingaben', () => {
    expect(punktHinzufuegen([], '   ')).toHaveLength(0);
    expect(punktHinzufuegen([], '  x  ')[0].text).toBe('x');
  });
});

describe('punktEntfernen', () => {
  it('entfernt nach ID', () => {
    const l = [{ id: 'a', text: '1' }, { id: 'b', text: '2' }];
    expect(punktEntfernen(l, 'a')).toEqual([{ id: 'b', text: '2' }]);
  });
});

describe('punktBearbeiten', () => {
  it('ändert den Text', () => {
    const l = [{ id: 'a', text: 'alt' }];
    expect(punktBearbeiten(l, 'a', 'neu')[0].text).toBe('neu');
  });
  it('behält den alten Text bei Leereingabe', () => {
    const l = [{ id: 'a', text: 'alt' }];
    expect(punktBearbeiten(l, 'a', '   ')[0].text).toBe('alt');
  });
});

describe('verschiebe', () => {
  const l = [{ id: 'a', text: '1' }, { id: 'b', text: '2' }, { id: 'c', text: '3' }];
  it('bewegt einen Punkt nach oben', () => {
    expect(verschiebe(l, 'b', -1).map(p => p.id)).toEqual(['b', 'a', 'c']);
  });
  it('bewegt einen Punkt nach unten', () => {
    expect(verschiebe(l, 'b', 1).map(p => p.id)).toEqual(['a', 'c', 'b']);
  });
  it('lässt das erste Element am Rand unverändert', () => {
    expect(verschiebe(l, 'a', -1)).toEqual(l);
  });
  it('lässt das letzte Element am Rand unverändert', () => {
    expect(verschiebe(l, 'c', 1)).toEqual(l);
  });
});
