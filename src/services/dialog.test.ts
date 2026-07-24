import { describe, it, expect, beforeEach } from 'vitest';
import { bestaetige, melde, frageDialog, aktuelleAnfrage, antworteDialog, abonniereDialog } from './dialog';

// Zwischen den Tests offene Anfragen sauber schließen.
beforeEach(() => {
  while (aktuelleAnfrage()) antworteDialog(false);
});

describe('bestaetige', () => {
  it('zeigt sofort eine Anfrage und löst mit true bei Bestätigung', async () => {
    const p = bestaetige('Wirklich?');
    expect(aktuelleAnfrage()?.text).toBe('Wirklich?');
    antworteDialog(true);
    expect(await p).toBe(true);
    expect(aktuelleAnfrage()).toBeNull();
  });

  it('löst mit false bei Abbruch', async () => {
    const p = bestaetige('Wirklich?');
    antworteDialog(false);
    expect(await p).toBe(false);
  });

  it('reicht die Gefahr-Markierung durch', () => {
    bestaetige('Löschen?', { gefaehrlich: true });
    expect(aktuelleAnfrage()?.gefaehrlich).toBe(true);
  });
});

describe('melde', () => {
  it('ist eine Meldung, nicht eine Bestätigung', () => {
    melde('Fertig');
    expect(aktuelleAnfrage()?.art).toBe('melden');
  });
});

describe('Warteschlange', () => {
  it('arbeitet mehrere Anfragen nacheinander ab', async () => {
    const p1 = frageDialog({ art: 'bestaetigen', text: 'Erste' });
    const p2 = frageDialog({ art: 'bestaetigen', text: 'Zweite' });
    // Nur die erste ist sichtbar.
    expect(aktuelleAnfrage()?.text).toBe('Erste');
    antworteDialog(true);
    expect(await p1).toBe(true);
    // Jetzt rückt die zweite nach.
    expect(aktuelleAnfrage()?.text).toBe('Zweite');
    antworteDialog(false);
    expect(await p2).toBe(false);
    expect(aktuelleAnfrage()).toBeNull();
  });
});

describe('abonniereDialog', () => {
  it('benachrichtigt den Host bei neuer Anfrage und meldet sich sauber ab', () => {
    let rufe = 0;
    const ab = abonniereDialog(() => { rufe++; });
    melde('Hallo');
    expect(rufe).toBeGreaterThan(0);
    const bisher = rufe;
    ab();
    antworteDialog(true);
    // Nach dem Abmelden keine weiteren Benachrichtigungen.
    expect(rufe).toBe(bisher);
  });
});
