import { afterEach, describe, expect, it, vi } from 'vitest';
import { aktuellerHinweis, fuehreRueckgaengigAus, schliesseHinweis, zeigeRueckgaengig } from './rueckgaengig';

describe('rueckgaengig', () => {
  afterEach(() => { schliesseHinweis(); vi.useRealTimers(); });

  it('zeigt den Hinweis und holt beim Klick zurück', async () => {
    const zurueck = vi.fn();
    zeigeRueckgaengig('Flug gelöscht', zurueck);
    expect(aktuellerHinweis()?.text).toBe('Flug gelöscht');
    await fuehreRueckgaengigAus();
    expect(zurueck).toHaveBeenCalledOnce();
    expect(aktuellerHinweis()).toBeNull();
  });

  it('verschwindet nach der Zeit, ohne zurückzuholen', () => {
    vi.useFakeTimers();
    const zurueck = vi.fn();
    zeigeRueckgaengig('Akku gelöscht', zurueck, 1000);
    vi.advanceTimersByTime(1001);
    expect(aktuellerHinweis()).toBeNull();
    expect(zurueck).not.toHaveBeenCalled();
  });

  it('ein neuer Hinweis ersetzt den alten; nur der neue lässt sich zurückholen', async () => {
    const alt = vi.fn();
    const neu = vi.fn();
    zeigeRueckgaengig('A', alt);
    zeigeRueckgaengig('B', neu);
    await fuehreRueckgaengigAus();
    expect(alt).not.toHaveBeenCalled();
    expect(neu).toHaveBeenCalledOnce();
  });
});
