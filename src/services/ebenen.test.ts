import { describe, expect, it, vi } from 'vitest';
import { anzahlEbenen, oeffneEbene, schliesseOberste } from './ebenen';

describe('ebenen', () => {
  it('schließt immer nur die zuletzt geöffnete Ebene', () => {
    const unten = vi.fn();
    const oben = vi.fn();
    const abUnten = oeffneEbene(unten);
    const abOben = oeffneEbene(oben);
    expect(schliesseOberste()).toBe(true);
    expect(oben).toHaveBeenCalledOnce();
    expect(unten).not.toHaveBeenCalled();
    abOben();
    abUnten();
  });

  it('nach dem Abmelden ist die darunterliegende Ebene oben', () => {
    const unten = vi.fn();
    const abUnten = oeffneEbene(unten);
    const abOben = oeffneEbene(vi.fn());
    abOben();
    schliesseOberste();
    expect(unten).toHaveBeenCalledOnce();
    abUnten();
  });

  it('ohne offene Ebene passiert nichts', () => {
    expect(anzahlEbenen()).toBe(0);
    expect(schliesseOberste()).toBe(false);
  });
});
