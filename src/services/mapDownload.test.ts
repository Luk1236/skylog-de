import { describe, it, expect } from 'vitest';
import { berechneFortschritt } from './mapDownload';

describe('berechneFortschritt', () => {
  it('rechnet den Anteil in Prozent', () => {
    expect(berechneFortschritt(50, 200).prozent).toBe(25);
    expect(berechneFortschritt(200, 200).prozent).toBe(100);
  });

  it('reicht die Rohwerte durch', () => {
    const f = berechneFortschritt(120, 480);
    expect(f.geladen).toBe(120);
    expect(f.gesamt).toBe(480);
  });

  // Ohne content-length darf kein Prozentwert erfunden werden — die Anzeige
  // soll dann einen unbestimmten Balken zeigen.
  it('liefert null, wenn die Gesamtgröße unbekannt ist', () => {
    expect(berechneFortschritt(1000, 0).prozent).toBeNull();
    expect(berechneFortschritt(1000, Number.NaN).prozent).toBeNull();
  });

  // Bei Umleitungen kann content-length kleiner sein als die gelesenen Bytes.
  it('deckelt bei 100 statt über den Balken hinauszulaufen', () => {
    expect(berechneFortschritt(300, 200).prozent).toBe(100);
  });

  it('startet bei 0', () => {
    expect(berechneFortschritt(0, 500).prozent).toBe(0);
  });
});
