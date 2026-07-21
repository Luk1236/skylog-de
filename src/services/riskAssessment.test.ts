import { describe, it, expect } from 'vitest';
import { bewerteBetrieb, type RisikoEingabe } from './riskAssessment';

function eingabe(over: Partial<RisikoEingabe> = {}): RisikoEingabe {
  return {
    uasClass: 'C1',
    weight: 249,
    szenario: 'keine_unbeteiligten',
    menschenansammlung: false,
    inBebautemGebiet: false,
    hoehe: 100,
    vlos: true,
    ...over,
  };
}

describe('Harte Open-Grenzen -> Specific', () => {
  it('ab 25 kg', () => {
    const r = bewerteBetrieb(eingabe({ weight: 26000 }));
    expect(r.kategorie).toBe('Specific');
    expect(r.gruende.join(' ')).toMatch(/25 kg/);
  });
  it('ohne VLOS', () => {
    expect(bewerteBetrieb(eingabe({ vlos: false })).kategorie).toBe('Specific');
  });
  it('über 120 m', () => {
    expect(bewerteBetrieb(eingabe({ hoehe: 150 })).kategorie).toBe('Specific');
  });
  it('über Menschenansammlung', () => {
    expect(bewerteBetrieb(eingabe({ menschenansammlung: true })).kategorie).toBe('Specific');
  });
});

describe('A1 — leichte Drohnen', () => {
  it('unter 250 g darf über Unbeteiligte, ohne Verstoß', () => {
    const r = bewerteBetrieb(eingabe({ uasClass: 'C0', weight: 249, szenario: 'ueber_unbeteiligten' }));
    expect(r.kategorie).toBe('A1');
    expect(r.verstoesse).toHaveLength(0);
    expect(r.kompetenz).toMatch(/unter 250 g|Kein Nachweis/);
  });

  it('C1 landet in A1, aber Überflug Unbeteiligter ist ein Verstoß', () => {
    const r = bewerteBetrieb(eingabe({ uasClass: 'C1', weight: 500, szenario: 'ueber_unbeteiligten' }));
    expect(r.kategorie).toBe('A1');
    expect(r.verstoesse.join(' ')).toMatch(/nicht gezielt über Unbeteiligte/);
  });
});

describe('A2 — C2', () => {
  it('C2 landet in A2 mit 30-m-Auflage', () => {
    const r = bewerteBetrieb(eingabe({ uasClass: 'C2', weight: 2000 }));
    expect(r.kategorie).toBe('A2');
    expect(r.anforderungen.join(' ')).toMatch(/30 m/);
    expect(r.kompetenz).toMatch(/A2/);
  });
  it('Überflug Unbeteiligter ist in A2 ein Verstoß', () => {
    const r = bewerteBetrieb(eingabe({ uasClass: 'C2', weight: 2000, szenario: 'ueber_unbeteiligten' }));
    expect(r.verstoesse.join(' ')).toMatch(/kein Überflug/);
  });
});

describe('A3 — schwere Drohnen', () => {
  it('C3 landet in A3', () => {
    const r = bewerteBetrieb(eingabe({ uasClass: 'C3', weight: 5000 }));
    expect(r.kategorie).toBe('A3');
    expect(r.anforderungen.join(' ')).toMatch(/150 m/);
  });
  it('Unbeteiligte im Bereich sind ein A3-Verstoß', () => {
    const r = bewerteBetrieb(eingabe({ uasClass: 'C3', weight: 5000, szenario: 'nahe_unbeteiligten' }));
    expect(r.verstoesse.join(' ')).toMatch(/keine Unbeteiligten/);
  });
  it('bebautes Gebiet ist ein A3-Verstoß', () => {
    const r = bewerteBetrieb(eingabe({ uasClass: 'C4', weight: 8000, inBebautemGebiet: true }));
    expect(r.verstoesse.join(' ')).toMatch(/150 m Abstand/);
  });
});

describe('Legacy nach Gewicht', () => {
  it('schwerer Legacy ohne Klasse landet in A3', () => {
    expect(bewerteBetrieb(eingabe({ uasClass: 'Legacy', weight: 6000 })).kategorie).toBe('A3');
  });
  it('leichter Legacy (<250 g) landet in A1', () => {
    expect(bewerteBetrieb(eingabe({ uasClass: 'Legacy', weight: 200 })).kategorie).toBe('A1');
  });
});
