import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  calculateInitialGrc, calculateInitialArc, determineSail, evaluateSora, osoFuerSail, robustheitText,
  generateSoraPdf, type Arc, type Sail, type SoraInput,
} from './sora25';

// jsPDF nachbauen: Texte und Dateiname mitschreiben statt eine Datei zu erzeugen.
const pdf = vi.hoisted(() => ({ texte: [] as string[], seiten: 1, datei: '' }));
vi.mock('jspdf', () => ({
  jsPDF: class {
    setFillColor() {}
    rect() {}
    setTextColor() {}
    setFontSize() {}
    setFont() {}
    setDrawColor() {}
    line() {}
    splitTextToSize(text: string, breite: number) {
      // grob: 2 mm je Zeichen
      const proZeile = Math.floor(breite / 2);
      const zeilen: string[] = [];
      for (let i = 0; i < text.length; i += proZeile) zeilen.push(text.slice(i, i + proZeile));
      return zeilen;
    }
    text(t: string) { pdf.texte.push(t); }
    addPage() { pdf.seiten++; }
    save(name: string) { pdf.datei = name; }
  },
}));

const basis: SoraInput = {
  operationTitle: 'Test Flight',
  environment: 'sparse',
  visibility: 'vlos',
  airspace: 'uncontrolled',
  maxAltitudeM: 100,
  droneMtomKg: 2.0,
  m1Mitigation: false,
  m2Mitigation: false,
};

describe('calculateInitialGrc', () => {
  it('stuft nach Umgebung und Abflugmasse ein (Grenzen 1 kg und 4 kg)', () => {
    expect(calculateInitialGrc('controlled', 0.9)).toBe(1);
    expect(calculateInitialGrc('controlled', 1.01)).toBe(2);
    expect(calculateInitialGrc('controlled', 4)).toBe(2);
    expect(calculateInitialGrc('controlled', 4.01)).toBe(3);
    expect(calculateInitialGrc('sparse', 1)).toBe(2);
    expect(calculateInitialGrc('sparse', 2.0)).toBe(3);
    expect(calculateInitialGrc('sparse', 25)).toBe(4);
    expect(calculateInitialGrc('populated', 0.9)).toBe(4);
    expect(calculateInitialGrc('populated', 3.5)).toBe(5);
    expect(calculateInitialGrc('populated', 6)).toBe(6);
    expect(calculateInitialGrc('assembly', 0.5)).toBe(6);
    expect(calculateInitialGrc('assembly', 2)).toBe(7);
    expect(calculateInitialGrc('assembly', 5.0)).toBe(8);
  });

  it('gibt Drohnen bis 250 g iGRC 1 - außer über Menschenansammlungen', () => {
    expect(calculateInitialGrc('populated', 0.249)).toBe(1);
    expect(calculateInitialGrc('sparse', 0.25)).toBe(1);
    expect(calculateInitialGrc('assembly', 0.249)).toBe(6);
  });
});

describe('calculateInitialArc', () => {
  it('setzt Flughafen und Sperrgebiet auf ARC-d', () => {
    expect(calculateInitialArc('airport', 50)).toBe('ARC-d');
    expect(calculateInitialArc('prohibited', 30)).toBe('ARC-d');
  });

  it('unterscheidet im kontrollierten Luftraum nach Höhe', () => {
    expect(calculateInitialArc('controlled', 100)).toBe('ARC-c');
    expect(calculateInitialArc('controlled', 120)).toBe('ARC-c');
    expect(calculateInitialArc('controlled', 121)).toBe('ARC-d');
  });

  it('unterscheidet im unkontrollierten Luftraum Land und Stadt', () => {
    expect(calculateInitialArc('uncontrolled', 100)).toBe('ARC-b');
    expect(calculateInitialArc('uncontrolled', 100, 'controlled')).toBe('ARC-b');
    expect(calculateInitialArc('uncontrolled', 100, 'populated')).toBe('ARC-c');
    expect(calculateInitialArc('uncontrolled', 100, 'assembly')).toBe('ARC-c');
    expect(calculateInitialArc('uncontrolled', 150)).toBe('ARC-c');
  });
});

describe('determineSail', () => {
  // Matrix aus JARUS SORA 2.5 (Step #7), gegengeprüft mit der EASA-Übersicht.
  const MATRIX: [number, Sail[]][] = [
    [1, ['SAIL I', 'SAIL II', 'SAIL IV', 'SAIL VI']],
    [2, ['SAIL I', 'SAIL II', 'SAIL IV', 'SAIL VI']],
    [3, ['SAIL II', 'SAIL II', 'SAIL IV', 'SAIL VI']],
    [4, ['SAIL III', 'SAIL III', 'SAIL IV', 'SAIL VI']],
    [5, ['SAIL IV', 'SAIL IV', 'SAIL IV', 'SAIL VI']],
    [6, ['SAIL V', 'SAIL V', 'SAIL V', 'SAIL VI']],
    [7, ['SAIL VI', 'SAIL VI', 'SAIL VI', 'SAIL VI']],
  ];
  const ARCS: Arc[] = ['ARC-a', 'ARC-b', 'ARC-c', 'ARC-d'];

  it.each(MATRIX)('finaler GRC %i ergibt die offizielle Zeile', (grc, zeile) => {
    expect(ARCS.map(arc => determineSail(grc, arc))).toEqual(zeile);
  });

  it('ARC-d ergibt immer SAIL VI (früher fälschlich SAIL V)', () => {
    expect(determineSail(3, 'ARC-d')).toBe('SAIL VI');
  });

  it('niedriger GRC in ARC-c ergibt SAIL IV (früher fälschlich SAIL III)', () => {
    expect(determineSail(4, 'ARC-c')).toBe('SAIL IV');
    expect(determineSail(2, 'ARC-c')).toBe('SAIL IV');
  });
});

describe('osoFuerSail', () => {
  it('verlangt bei SAIL I nur OSOs mit niedriger Robustheit', () => {
    const osos = osoFuerSail('SAIL I');
    expect(osos.length).toBeGreaterThan(0);
    expect(osos.every(o => o.robustheit === 'L')).toBe(true);
    expect(osos.map(o => o.nummer)).not.toContain('OSO #01');
  });

  it('verlangt bei SAIL VI alle 18 OSOs mit hoher Robustheit', () => {
    const osos = osoFuerSail('SAIL VI');
    expect(osos).toHaveLength(18);
    expect(osos.every(o => o.robustheit === 'H')).toBe(true);
  });

  it('kennt die Abstufung je SAIL (Beispiel OSO #04 Konstruktionsstandard)', () => {
    const stufe = (sail: Sail) => osoFuerSail(sail).find(o => o.nummer === 'OSO #04')?.robustheit;
    expect(stufe('SAIL III')).toBeUndefined();
    expect(stufe('SAIL IV')).toBe('L');
    expect(stufe('SAIL V')).toBe('M');
    expect(stufe('SAIL VI')).toBe('H');
  });

  it('führt den Notfallplan unter OSO #08 (M3 gibt es in SORA 2.5 nicht mehr)', () => {
    const oso08 = osoFuerSail('SAIL II').find(o => o.nummer === 'OSO #08');
    expect(oso08?.titel).toContain('Notfallplan');
    expect(oso08?.robustheit).toBe('M');
  });

  it('hat für jedes OSO einen englischen Titel', () => {
    for (const oso of osoFuerSail('SAIL VI')) expect(oso.titelEn.length).toBeGreaterThan(10);
  });
});

describe('robustheitText', () => {
  it('liefert Deutsch und Englisch', () => {
    expect(robustheitText('M')).toBe('mittel');
    expect(robustheitText('H', 'en')).toBe('high');
  });
});

describe('evaluateSora', () => {
  it('rechnet einen typischen Flug mit Minderungen durch', () => {
    const res = evaluateSora({ ...basis, m1Mitigation: true, m2Mitigation: true });
    expect(res.initialGrc).toBe(3);
    expect(res.finalGrc).toBe(1);
    expect(res.initialArc).toBe('ARC-b');
    expect(res.finalArc).toBe('ARC-b');
    expect(res.sail).toBe('SAIL II');
    expect(res.ausserhalbSora).toBe(false);
    expect(res.requiredOsos).toEqual(osoFuerSail('SAIL II'));
  });

  it('senkt den GRC nicht unter 1', () => {
    const res = evaluateSora({ ...basis, environment: 'controlled', droneMtomKg: 0.9, m1Mitigation: true, m2Mitigation: true });
    expect(res.finalGrc).toBe(1);
  });

  it('meldet einen finalen GRC über 7 als außerhalb von SORA', () => {
    const res = evaluateSora({ ...basis, environment: 'assembly', droneMtomKg: 5 });
    expect(res.finalGrc).toBe(8);
    expect(res.ausserhalbSora).toBe(true);
    expect(res.sail).toBe('SAIL VI');
  });

  it('wertet besiedeltes Gebiet im unkontrollierten Luftraum als ARC-c', () => {
    const res = evaluateSora({ ...basis, environment: 'populated', droneMtomKg: 0.9 });
    expect(res.finalArc).toBe('ARC-c');
    expect(res.sail).toBe('SAIL IV');
  });
});

describe('generateSoraPdf', () => {
  beforeEach(() => {
    pdf.texte = [];
    pdf.seiten = 1;
    pdf.datei = '';
  });

  it('schreibt Betreiber, Ergebnis und alle OSOs ins Dossier', async () => {
    const res = evaluateSora(basis);
    await generateSoraPdf(basis, res, { model: 'DJI Mini 4 Pro' } as never, { name: 'Erika Muster', eid: 'DEU-123' } as never);
    const alles = pdf.texte.join('\n');
    expect(alles).toContain('Betreiber: Erika Muster');
    expect(alles).toContain('LBA e-ID: DEU-123');
    expect(alles).toContain('DJI Mini 4 Pro');
    expect(alles).toContain(`ERGEBNIS: ${res.sail}`);
    for (const oso of res.requiredOsos) expect(alles).toContain(oso.nummer);
    expect(alles).toContain('Vorabschätzung nach SORA 2.5');
    expect(pdf.datei).toBe('skylog_sora25_dossier_SAIL_II.pdf');
  });

  it('nutzt Platzhalter ohne Profil und Drohne', async () => {
    await generateSoraPdf(basis, evaluateSora(basis), null, null);
    const alles = pdf.texte.join('\n');
    expect(alles).toContain('Betreiber: Unbekannt');
    expect(alles).toContain('LBA e-ID: Nicht angegeben');
    expect(alles).toContain('Generic UAS');
  });

  it('weist „außerhalb SORA“ aus und bricht lange Listen auf neue Seiten um', async () => {
    const eingabe: SoraInput = { ...basis, environment: 'assembly', droneMtomKg: 5 };
    await generateSoraPdf(eingabe, evaluateSora(eingabe), null, null);
    const alles = pdf.texte.join('\n');
    expect(alles).toContain('ERGEBNIS: außerhalb SORA');
    expect(alles).toContain('zulassungspflichtige Kategorie');
    expect(pdf.seiten).toBeGreaterThan(1);
  });
});
