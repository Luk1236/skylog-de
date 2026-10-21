import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  bestimmeIgrc, igrcSpalte, berechneFinalGrc, igrcQuelle, bevoelkerungText, warnungText, minderungenText,
  calculateInitialArc, determineSail, evaluateSora, osoFuerSail, robustheitText, generateSoraPdf,
  BEVOELKERUNG_STUFEN, KEINE_MINDERUNG,
  type Arc, type Sail, type SoraInput, type Bevoelkerung, type GrcMinderungen,
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
  visibility: 'vlos',
  airspace: 'uncontrolled',
  maxAltitudeM: 100,
  droneMtomKg: 2.0,
  abmessungM: 1,
  geschwindigkeitMs: 20,
  bevoelkerung: 'unter50',
  ueberStadt: false,
  minderungen: KEINE_MINDERUNG,
};

// Table 1 aus EASA AMC1 Art. 11 (SORA 2.5), ED Decision 2025/018/R, S. 24 -
// hier bewusst ein zweites Mal abgeschrieben, damit ein Tippfehler im Code auffällt.
// null = graue Zelle „Not part of SORA“.
const SPALTEN: [number, number][] = [[1, 25], [3, 35], [8, 75], [20, 120], [40, 200]];
const OFFIZIELL: [Bevoelkerung, (number | null)[]][] = [
  ['kontrolliert', [1, 1, 2, 3, 3]],
  ['unter5', [2, 3, 4, 5, 6]],
  ['unter50', [3, 4, 5, 6, 7]],
  ['unter500', [4, 5, 6, 7, 8]],
  ['unter5000', [5, 6, 7, 8, 9]],
  ['unter50000', [6, 7, 8, 9, 10]],
  ['ueber50000', [7, 8, null, null, null]],
];
const ZELLEN = OFFIZIELL.flatMap(([zeile, werte]) => werte.map((wert, spalte) => ({ zeile, spalte, wert })));

describe('iGRC-Tabelle (SORA 2.5, Table 1)', () => {
  it('hat 7 Zeilen und 35 Zellen', () => {
    expect(BEVOELKERUNG_STUFEN).toEqual(OFFIZIELL.map(([z]) => z));
    expect(ZELLEN).toHaveLength(35);
  });

  it.each(ZELLEN)('Zeile $zeile, Spalte $spalte ergibt $wert (an der Spaltengrenze)', ({ zeile, spalte, wert }) => {
    const [d, v] = SPALTEN[spalte];
    const r = bestimmeIgrc(d, v, zeile, 2);
    expect(r.spalte).toBe(spalte);
    expect(r.wert).toBe(wert);
    expect(r.quelle).toBe(wert === null ? 'graue-zelle' : 'tabelle');
  });

  it.each(ZELLEN)('Zeile $zeile, Spalte $spalte ergibt $wert (knapp über der Spalte davor)', ({ zeile, spalte, wert }) => {
    const [d, v] = spalte === 0 ? [0.3, 10] : [SPALTEN[spalte - 1][0] + 0.01, SPALTEN[spalte - 1][1] + 0.1];
    expect(bestimmeIgrc(d, v, zeile, 30).wert).toBe(wert);
  });
});

describe('igrcSpalte', () => {
  it('nimmt die Spalte, die Abmessung und Geschwindigkeit abdeckt', () => {
    expect(igrcSpalte(0.5, 20)).toBe(0);
    expect(igrcSpalte(0.5, 40)).toBe(2); // Geschwindigkeit entscheidet
    expect(igrcSpalte(10, 20)).toBe(3);  // Abmessung entscheidet
    expect(igrcSpalte(1.01, 25)).toBe(1);
    expect(igrcSpalte(1, 25.1)).toBe(1);
  });

  it('liefert null über 40 m oder 200 m/s', () => {
    expect(igrcSpalte(40.1, 50)).toBeNull();
    expect(igrcSpalte(2, 201)).toBeNull();
  });
});

describe('bestimmeIgrc', () => {
  it.each(BEVOELKERUNG_STUFEN.filter(b => b !== 'ueber50000'))('250-g-Regel ergibt iGRC 1 in Zeile %s', zeile => {
    const r = bestimmeIgrc(0.3, 25, zeile, 0.25);
    expect(r.wert).toBe(1);
    expect(r.quelle).toBe('regel-250g');
  });

  it('wendet die 250-g-Regel nicht über Menschenansammlungen an', () => {
    expect(bestimmeIgrc(0.3, 25, 'ueber50000', 0.249)).toMatchObject({ wert: 7, quelle: 'tabelle' });
  });

  it('wendet die 250-g-Regel nur bis 25 m/s und 250 g an', () => {
    expect(bestimmeIgrc(0.3, 26, 'unter5000', 0.2)).toMatchObject({ wert: 6, quelle: 'tabelle' });
    expect(bestimmeIgrc(0.3, 20, 'unter5000', 0.26)).toMatchObject({ wert: 5, quelle: 'tabelle' });
  });

  it('meldet Werte außerhalb der Tabelle', () => {
    expect(bestimmeIgrc(45, 50, 'unter5', 100)).toEqual({ wert: null, spalte: null, bevoelkerung: 'unter5', quelle: 'ausserhalb-tabelle' });
  });
});

describe('berechneFinalGrc (Step #3, Table 5)', () => {
  const igrc = bestimmeIgrc(3, 35, 'unter5000', 5); // iGRC 6, Untergrenze 1
  const mit = (m: Partial<GrcMinderungen>) => berechneFinalGrc(igrc, { ...KEINE_MINDERUNG, ...m });

  it.each([
    [{ m1a: 'L' }, 1], [{ m1a: 'M' }, 2],
    [{ m1b: 'M' }, 1], [{ m1b: 'H' }, 2],
    [{ m1c: 'L' }, 1],
    [{ m2: 'M' }, 1], [{ m2: 'H' }, 2],
  ] as [Partial<GrcMinderungen>, number][])('%o senkt um %i', (m, abzug) => {
    expect(mit(m)).toEqual({ finalGrc: 6 - abzug, abzug, warnungen: [] });
  });

  it('addiert mehrere Minderungen', () => {
    expect(mit({ m1a: 'L', m1b: 'M', m1c: 'L', m2: 'M' })?.finalGrc).toBe(2);
  });

  it('senkt nicht unter den Wert für kontrollierten Bodenbereich derselben Spalte', () => {
    const groß = bestimmeIgrc(20, 100, 'unter50', 50); // iGRC 6, Untergrenze 3
    const r = berechneFinalGrc(groß, { m1a: 'L', m1b: 'H', m1c: 'L', m2: 'H' });
    expect(r).toEqual({ finalGrc: 3, abzug: 3, warnungen: [] });
  });

  it('senkt nie unter 1', () => {
    expect(mit({ m1a: 'M', m1c: 'L', m2: 'H' })?.finalGrc).toBe(1);
  });

  it('rechnet M1(B) bei M1(A) mittel nicht an', () => {
    expect(mit({ m1a: 'M', m1b: 'H' })).toEqual({ finalGrc: 4, abzug: 2, warnungen: ['m1a-mittel-mit-m1b'] });
    expect(mit({ m1a: 'L', m1b: 'H' })).toEqual({ finalGrc: 3, abzug: 3, warnungen: [] });
  });

  it('rechnet M1(A) über Menschenansammlungen nicht an', () => {
    const ansammlung = bestimmeIgrc(1, 25, 'ueber50000', 1);
    expect(berechneFinalGrc(ansammlung, { ...KEINE_MINDERUNG, m1a: 'L', m2: 'M' }))
      .toEqual({ finalGrc: 6, abzug: 1, warnungen: ['m1a-ueber-ansammlung'] });
  });

  it('liefert null ohne iGRC', () => {
    expect(berechneFinalGrc(bestimmeIgrc(8, 75, 'ueber50000', 10), KEINE_MINDERUNG)).toBeNull();
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
    expect(calculateInitialArc('uncontrolled', 100, true)).toBe('ARC-c');
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

describe('Texte', () => {
  it('liefert Robustheit auf Deutsch und Englisch', () => {
    expect(robustheitText('M')).toBe('mittel');
    expect(robustheitText('H', 'en')).toBe('high');
  });

  it('beschriftet jede Zeile zweisprachig', () => {
    for (const b of BEVOELKERUNG_STUFEN) {
      expect(bevoelkerungText(b).length).toBeGreaterThan(5);
      expect(bevoelkerungText(b, 'en').length).toBeGreaterThan(5);
    }
    expect(bevoelkerungText('ueber50000')).toContain('Menschenansammlungen');
  });

  it('nennt die Quelle des iGRC mit Spalte, Zeile und Seite', () => {
    const q = igrcQuelle(bestimmeIgrc(3, 30, 'unter500', 2));
    expect(q).toContain('Spalte 3 m / 35 m/s');
    expect(q).toContain('< 500 Pers./km²');
    expect(q).toContain('ED Decision 2025/018/R, S. 24');
    expect(igrcQuelle(bestimmeIgrc(0.2, 16, 'unter5000', 0.249))).toContain('250-g-Regel');
    expect(igrcQuelle(bestimmeIgrc(8, 70, 'ueber50000', 9))).toContain('Graue Zelle');
    expect(igrcQuelle(bestimmeIgrc(50, 70, 'unter5', 90), 'en')).toContain('Annex F');
    expect(igrcQuelle(bestimmeIgrc(1, 20, 'unter5', 2), 'en')).toContain('column 1 m / 25 m/s');
  });

  it('beschreibt Minderungen und Warnungen', () => {
    expect(minderungenText(KEINE_MINDERUNG)).toBe('keine');
    expect(minderungenText({ m1a: 'L', m1b: null, m1c: null, m2: 'H' })).toBe('M1(A) niedrig, M2 hoch');
    expect(minderungenText({ ...KEINE_MINDERUNG, m1c: 'L' }, 'en')).toBe('M1(C) low');
    expect(warnungText('m1a-mittel-mit-m1b')).toContain('M1(B)');
    expect(warnungText('m1a-ueber-ansammlung', 'en')).toContain('assemblies');
  });
});

describe('evaluateSora', () => {
  it('rechnet einen typischen Flug mit Minderungen durch', () => {
    const res = evaluateSora({ ...basis, minderungen: { ...KEINE_MINDERUNG, m1a: 'L', m2: 'M' } });
    expect(res.initialGrc).toBe(3);
    expect(res.grcAbzug).toBe(2);
    expect(res.finalGrc).toBe(1);
    expect(res.initialArc).toBe('ARC-b');
    expect(res.finalArc).toBe('ARC-b');
    expect(res.sail).toBe('SAIL II');
    expect(res.ausserhalbSora).toBe(false);
    expect(res.requiredOsos).toEqual(osoFuerSail('SAIL II'));
  });

  it('meldet einen finalen GRC über 7 als außerhalb von SORA', () => {
    const res = evaluateSora({ ...basis, abmessungM: 8, geschwindigkeitMs: 60, bevoelkerung: 'unter50000' });
    expect(res.finalGrc).toBe(8);
    expect(res.ausserhalbSora).toBe(true);
    expect(res.sail).toBeNull();
    expect(res.requiredOsos).toEqual([]);
  });

  it('holt einen GRC über 7 mit Minderungen wieder in SORA', () => {
    const res = evaluateSora({ ...basis, abmessungM: 8, geschwindigkeitMs: 60, bevoelkerung: 'unter50000', minderungen: { ...KEINE_MINDERUNG, m2: 'H' } });
    expect(res.finalGrc).toBe(6);
    expect(res.ausserhalbSora).toBe(false);
    expect(res.sail).toBe('SAIL V');
  });

  it('meldet graue Zellen als außerhalb von SORA - auch mit Minderungen', () => {
    const res = evaluateSora({ ...basis, abmessungM: 8, bevoelkerung: 'ueber50000', minderungen: { ...KEINE_MINDERUNG, m2: 'H' } });
    expect(res.initialGrc).toBeNull();
    expect(res.finalGrc).toBeNull();
    expect(res.ausserhalbSora).toBe(true);
    expect(res.sail).toBeNull();
  });

  it('bestimmt außerhalb der Tabelle keinen SAIL, ohne „außerhalb SORA“ zu behaupten', () => {
    const res = evaluateSora({ ...basis, abmessungM: 45 });
    expect(res.igrc.quelle).toBe('ausserhalb-tabelle');
    expect(res.sail).toBeNull();
    expect(res.ausserhalbSora).toBe(false);
  });

  it('wertet Stadtflug im unkontrollierten Luftraum als ARC-c', () => {
    const res = evaluateSora({ ...basis, ueberStadt: true });
    expect(res.finalArc).toBe('ARC-c');
    expect(res.sail).toBe('SAIL IV');
  });

  it('gibt Warnungen der Minderungen weiter', () => {
    const res = evaluateSora({ ...basis, bevoelkerung: 'unter5000', minderungen: { ...KEINE_MINDERUNG, m1a: 'M', m1b: 'M' } });
    expect(res.warnungen).toEqual(['m1a-mittel-mit-m1b']);
    expect(res.finalGrc).toBe(3);
  });
});

describe('generateSoraPdf', () => {
  beforeEach(() => {
    pdf.texte = [];
    pdf.seiten = 1;
    pdf.datei = '';
  });

  it('schreibt Betreiber, Kenngrößen, iGRC-Quelle, Ergebnis und alle OSOs ins Dossier', async () => {
    const eingabe: SoraInput = { ...basis, minderungen: { ...KEINE_MINDERUNG, m1c: 'L' } };
    const res = evaluateSora(eingabe);
    await generateSoraPdf(eingabe, res, { model: 'DJI Mini 4 Pro' } as never, { name: 'Erika Muster', eid: 'DEU-123' } as never);
    const alles = pdf.texte.join('\n');
    expect(alles).toContain('Betreiber: Erika Muster');
    expect(alles).toContain('LBA e-ID: DEU-123');
    expect(alles).toContain('DJI Mini 4 Pro');
    expect(alles).toContain('Charakt. Abmessung: 1 m');
    expect(alles).toContain('Höchstgeschwindigkeit: 20 m/s');
    expect(alles).toContain('Initial Ground Risk Class (iGRC): 3');
    expect(alles).toContain('Minderungen: M1(C) niedrig (-1 GRC)');
    expect(pdf.texte.join('')).toContain('ED Decision 2025/018/R');
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

  it('weist „außerhalb SORA“ aus', async () => {
    const eingabe: SoraInput = { ...basis, abmessungM: 8, bevoelkerung: 'ueber50000' };
    await generateSoraPdf(eingabe, evaluateSora(eingabe), null, null);
    const alles = pdf.texte.join('\n');
    expect(alles).toContain('ERGEBNIS: außerhalb SORA');
    expect(alles).toContain('iGRC): nicht bestimmbar');
    expect(alles).toContain('zulassungspflichtige Kategorie');
    expect(pdf.datei).toBe('skylog_sora25_dossier_ausserhalb_SORA.pdf');
  });

  it('meldet fehlenden SAIL außerhalb der Tabelle und Warnungen', async () => {
    const eingabe: SoraInput = { ...basis, abmessungM: 50, bevoelkerung: 'ueber50000', minderungen: { ...KEINE_MINDERUNG, m1a: 'L' } };
    await generateSoraPdf(eingabe, evaluateSora(eingabe), null, null);
    const alles = pdf.texte.join('\n');
    expect(alles).toContain('ERGEBNIS: nicht bestimmbar');
    expect(alles).toContain('Annex F');
    expect(pdf.datei).toBe('skylog_sora25_dossier_ohne_SAIL.pdf');

    const mitWarnung: SoraInput = { ...basis, bevoelkerung: 'ueber50000', minderungen: { ...KEINE_MINDERUNG, m1a: 'L' } };
    pdf.texte = [];
    await generateSoraPdf(mitWarnung, evaluateSora(mitWarnung), null, null);
    expect(pdf.texte.join('\n')).toContain('nicht über Menschenansammlungen');
  });

  it('bricht lange OSO-Listen auf neue Seiten um', async () => {
    const eingabe: SoraInput = { ...basis, airspace: 'airport' }; // ARC-d -> SAIL VI, 18 OSOs
    await generateSoraPdf(eingabe, evaluateSora(eingabe), null, null);
    expect(pdf.texte.join('\n')).toContain('ERGEBNIS: SAIL VI');
    expect(pdf.seiten).toBeGreaterThan(1);
  });
});
