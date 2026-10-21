import { describe, expect, it } from 'vitest';
import { offeneKategorie } from './offeneKategorie';

describe('offeneKategorie', () => {
  it('C0 und Drohnen ohne Klasse unter 250 g fliegen in A1 und dürfen über Unbeteiligte', () => {
    expect(offeneKategorie({ uasClass: 'C0', weight: 249 })).toEqual({ kategorie: 'A1', regel: 'ueberflugErlaubt', bestandAb250: false });
    expect(offeneKategorie({ uasClass: 'Legacy', weight: 249 }).regel).toBe('ueberflugErlaubt');
    expect(offeneKategorie({ uasClass: 'Self-built', weight: 120 }).kategorie).toBe('A1');
  });

  it('C1 fliegt in A1, aber ohne geplanten Überflug Unbeteiligter', () => {
    expect(offeneKategorie({ uasClass: 'C1', weight: 895 }, 'A1/A3')).toEqual({ kategorie: 'A1', regel: 'ueberflugVermeiden', bestandAb250: false });
  });

  it('C2 nur mit A2-Zeugnis in A2, sonst A3', () => {
    expect(offeneKategorie({ uasClass: 'C2', weight: 3500 }, 'A2')).toMatchObject({ kategorie: 'A2', regel: 'abstand30' });
    expect(offeneKategorie({ uasClass: 'C2', weight: 3500 }, 'A1/A3')).toMatchObject({ kategorie: 'A3', regel: 'abstand150' });
  });

  it('Bestandsdrohnen ab 250 g fliegen seit 2024 nur in A3 (früher bis 500 g in A1)', () => {
    expect(offeneKategorie({ uasClass: 'Legacy', weight: 400 })).toEqual({ kategorie: 'A3', regel: 'abstand150', bestandAb250: true });
    expect(offeneKategorie({ uasClass: 'Legacy', weight: 900 }).bestandAb250).toBe(true);
  });

  it('C3/C4 fliegen in A3', () => {
    expect(offeneKategorie({ uasClass: 'C3', weight: 6000 }, 'A2').kategorie).toBe('A3');
    expect(offeneKategorie({ uasClass: 'C4', weight: 2000 }).kategorie).toBe('A3');
  });

  it('rechnet ohne Gewichtsangabe vorsichtig mit A3', () => {
    expect(offeneKategorie({ uasClass: 'Legacy', weight: 0 }).kategorie).toBe('A3');
    expect(offeneKategorie({ uasClass: undefined as never, weight: undefined as never }).kategorie).toBe('A3');
  });
});
