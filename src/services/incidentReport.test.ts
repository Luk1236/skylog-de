import { describe, it, expect } from 'vitest';
import { baueVorfallBericht, fehlendePflichtfelder, type VorfallEingabe } from './incidentReport';
import type { UserProfile, Drone } from './db';

function eingabe(over: Partial<VorfallEingabe> = {}): VorfallEingabe {
  return {
    datum: '2026-07-20',
    uhrzeit: '14:30',
    ort: 'Darmstadt',
    drohne: { id: 'd1', model: 'Mini 4 Pro', uasClass: 'C0', weight: 249, eId: 'DEU-DR-x', createdAt: 0 } as Drone,
    betreiber: { id: 'main_profile', name: 'Lukas', eid: 'DEU-OP-1', licenseType: 'A2', insuranceNumber: 'V-1' } as UserProfile,
    kategorie: 'Kontrollverlust',
    beschreibung: 'Drohne reagierte kurz nicht auf Steuerbefehle.',
    personenschaden: false,
    sachschaden: false,
    ...over,
  };
}

describe('fehlendePflichtfelder', () => {
  it('meldet nichts, wenn alles da ist', () => {
    expect(fehlendePflichtfelder(eingabe())).toEqual([]);
  });

  it('erkennt fehlendes Datum, Ort, Beschreibung', () => {
    const f = fehlendePflichtfelder(eingabe({ datum: '', ort: '  ', beschreibung: '' }));
    expect(f).toContain('Datum');
    expect(f).toContain('Ort');
    expect(f).toContain('Beschreibung des Vorfalls');
  });

  it('verlangt Details, wenn Personenschaden angekreuzt ist', () => {
    const f = fehlendePflichtfelder(eingabe({ personenschaden: true }));
    expect(f).toContain('Details zum Personenschaden');
  });

  it('ist zufrieden, wenn Personenschaden-Details vorliegen', () => {
    const f = fehlendePflichtfelder(eingabe({ personenschaden: true, personenschadenDetails: 'Schürfwunde' }));
    expect(f).not.toContain('Details zum Personenschaden');
  });
});

describe('baueVorfallBericht', () => {
  it('enthält die Kernangaben', () => {
    const t = baueVorfallBericht(eingabe());
    expect(t).toContain('VORFALLMELDUNG');
    expect(t).toContain('20.07.2026');
    expect(t).toContain('Darmstadt');
    expect(t).toContain('Kontrollverlust');
    expect(t).toContain('BESCHREIBUNG DES VORFALLS:');
    expect(t).toContain('reagierte kurz nicht');
  });

  it('stellt Personen- und Sachschaden klar dar', () => {
    const t = baueVorfallBericht(eingabe({
      personenschaden: true, personenschadenDetails: 'Prellung',
      sachschaden: true, sachschadenDetails: 'Fensterscheibe',
    }));
    expect(t).toMatch(/Personenschaden: JA — Prellung/);
    expect(t).toMatch(/Sachschaden: JA — Fensterscheibe/);
  });

  it('zeigt "nein" ohne Schaden', () => {
    const t = baueVorfallBericht(eingabe());
    expect(t).toMatch(/Personenschaden: nein/);
    expect(t).toMatch(/Sachschaden: nein/);
  });

  it('übernimmt Betreiber- und Drohnendaten', () => {
    const t = baueVorfallBericht(eingabe());
    expect(t).toContain('DEU-OP-1');
    expect(t).toContain('Mini 4 Pro');
    expect(t).toContain('DEU-DR-x');
  });

  it('setzt Striche statt Lücken bei fehlenden optionalen Feldern', () => {
    const t = baueVorfallBericht(eingabe({ zeugen: '', massnahmen: '' }));
    expect(t).toMatch(/Zeugen: —/);
    expect(t).toMatch(/Sofortmaßnahmen: —/);
  });

  it('nennt die 72-Stunden-Frist', () => {
    expect(baueVorfallBericht(eingabe())).toMatch(/72 Stunden/);
  });

  it('funktioniert auch ganz ohne Betreiber/Drohne', () => {
    const t = baueVorfallBericht(eingabe({ betreiber: null, drohne: null }));
    expect(t).toContain('VORFALLMELDUNG');
    expect(t).toMatch(/Betreiber: —/);
  });
});
