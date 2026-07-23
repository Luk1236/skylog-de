import { describe, it, expect } from 'vitest';
import { ErrorBoundary, fehlerText } from './ErrorBoundary';

describe('getDerivedStateFromError', () => {
  it('schaltet in den Fehlerzustand und übernimmt die Fehlermeldung', () => {
    const s = ErrorBoundary.getDerivedStateFromError(new Error('kaputt'));
    expect(s.hasError).toBe(true);
    expect(s.message).toBe('kaputt');
  });

  it('verträgt auch geworfene Nicht-Error-Werte', () => {
    const s = ErrorBoundary.getDerivedStateFromError('nur ein String');
    expect(s.hasError).toBe(true);
    expect(s.message).toBe('nur ein String');
  });
});

describe('fehlerText', () => {
  it('liefert Deutsch als Standard', () => {
    const t = fehlerText('de');
    expect(t.titel).toBe('Etwas ist schiefgelaufen');
    expect(t.neuladen).toBe('App neu laden');
  });

  it('liefert Englisch bei en', () => {
    expect(fehlerText('en').titel).toBe('Something went wrong');
  });

  it('fällt bei unbekannter Sprache auf Deutsch zurück', () => {
    expect(fehlerText('klingonisch').neuladen).toBe('App neu laden');
  });

  it('betont in beiden Sprachen, dass die Daten sicher sind', () => {
    expect(fehlerText('de').beruhigung.toLowerCase()).toContain('sicher');
    expect(fehlerText('en').beruhigung.toLowerCase()).toContain('safe');
  });
});
