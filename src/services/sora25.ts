import type { UserProfile, Drone } from './db';

// SORA-Vorabschätzung für die spezifische Kategorie.
//
// Bodenrisiko (iGRC, Minderungen, finaler GRC) belegt nach EASA, „AMC & GM to
// Regulation (EU) 2019/947 - Issue 1, Amendment 3“ (Anhang zu ED Decision
// 2025/018/R). Darin ist JARUS SORA 2.5 als AMC1 Artikel 11 übernommen:
// https://www.easa.europa.eu/sites/default/files/dfu/annex_to_ed_decision_2025-018-r_1_2.pdf
//   - iGRC-Tabelle und 250-g-Regel: Step #2, Table 1, S. 24
//   - Spaltenwahl („rightmost column matching both criteria“), graue Zellen: S. 25
//   - Menschenansammlungen = Zeile > 50 000 Pers./km²: Table 2, S. 26
//   - Minderungen M1(A)/M1(B)/M1(C)/M2 je Robustheit: Step #3, Table 5, S. 29
//   - Untergrenze „kontrollierter Bodenbereich“: S. 30 (f) und Annex B, Grundsatz #8, S. 84
//   - M1(A) mittel nicht mit M1(B), M1(A) nicht über Menschenansammlungen: Annex B, S. 85
//   - finaler GRC über 7 außerhalb von SORA: S. 30
//   - charakteristische Abmessung (bei Multikoptern Diagonale zwischen den
//     Blattspitzen): Annex I, I.141, S. 170
// SAIL-Matrix und OSO-Robustheit nach JARUS SORA 2.5 / EASA-Übersicht (2023),
// gegengeprüft mit den EASA-Folien. Vereinfacht bleibt das Luftrisiko (keine
// strategische/taktische Minderung der ARC). Das Ergebnis ist eine
// Orientierung, kein Ersatz für die Bewertung im Antrag.

export type FlightVisibility = 'vlos' | 'bvlos';
export type AirspaceCategory = 'uncontrolled' | 'controlled' | 'airport' | 'prohibited';
export type Arc = 'ARC-a' | 'ARC-b' | 'ARC-c' | 'ARC-d';
export type Sail = 'SAIL I' | 'SAIL II' | 'SAIL III' | 'SAIL IV' | 'SAIL V' | 'SAIL VI';
/** Robustheit eines OSO oder einer Minderung: niedrig, mittel, hoch. */
export type Robustheit = 'L' | 'M' | 'H';

/** Zeilen der iGRC-Tabelle: höchste Bevölkerungsdichte im iGRC-Fußabdruck. */
export type Bevoelkerung = 'kontrolliert' | 'unter5' | 'unter50' | 'unter500' | 'unter5000' | 'unter50000' | 'ueber50000';
export const BEVOELKERUNG_STUFEN: Bevoelkerung[] = ['kontrolliert', 'unter5', 'unter50', 'unter500', 'unter5000', 'unter50000', 'ueber50000'];

/** Spalten der iGRC-Tabelle: größte charakteristische Abmessung und Höchstgeschwindigkeit. */
export const IGRC_SPALTEN: readonly { abmessungM: number; geschwindigkeitMs: number }[] = [
  { abmessungM: 1, geschwindigkeitMs: 25 },
  { abmessungM: 3, geschwindigkeitMs: 35 },
  { abmessungM: 8, geschwindigkeitMs: 75 },
  { abmessungM: 20, geschwindigkeitMs: 120 },
  { abmessungM: 40, geschwindigkeitMs: 200 },
];

// Table 1 (S. 24). null = graue Zelle „Not part of SORA“.
const IGRC_TABELLE: Record<Bevoelkerung, (number | null)[]> = {
  kontrolliert: [1, 1, 2, 3, 3],
  unter5: [2, 3, 4, 5, 6],
  unter50: [3, 4, 5, 6, 7],
  unter500: [4, 5, 6, 7, 8],
  unter5000: [5, 6, 7, 8, 9],
  unter50000: [6, 7, 8, 9, 10],
  ueber50000: [7, 8, null, null, null],
};

export interface IgrcBestimmung {
  /** iGRC oder null, wenn die Tabelle keinen Wert liefert. */
  wert: number | null;
  /** Tabellenspalte 0-4; null bei mehr als 40 m oder 200 m/s. */
  spalte: number | null;
  bevoelkerung: Bevoelkerung;
  quelle: 'tabelle' | 'regel-250g' | 'graue-zelle' | 'ausserhalb-tabelle';
}

/** Spalte, die Abmessung UND Geschwindigkeit abdeckt (die weiter rechts liegende). */
export function igrcSpalte(abmessungM: number, geschwindigkeitMs: number): number | null {
  const i = IGRC_SPALTEN.findIndex(s => abmessungM <= s.abmessungM && geschwindigkeitMs <= s.geschwindigkeitMs);
  return i < 0 ? null : i;
}

export function bestimmeIgrc(abmessungM: number, geschwindigkeitMs: number, bevoelkerung: Bevoelkerung, mtomKg: number): IgrcBestimmung {
  const spalte = igrcSpalte(abmessungM, geschwindigkeitMs);
  // Höchstens 250 g und 25 m/s: iGRC 1 unabhängig von der Dichte, außer über
  // Menschenansammlungen (laut Table 2 die Zeile > 50 000).
  if (mtomKg <= 0.25 && geschwindigkeitMs <= 25 && bevoelkerung !== 'ueber50000') {
    return { wert: 1, spalte, bevoelkerung, quelle: 'regel-250g' };
  }
  if (spalte === null) return { wert: null, spalte, bevoelkerung, quelle: 'ausserhalb-tabelle' };
  const wert = IGRC_TABELLE[bevoelkerung][spalte];
  return wert === null
    ? { wert: null, spalte, bevoelkerung, quelle: 'graue-zelle' }
    : { wert, spalte, bevoelkerung, quelle: 'tabelle' };
}

/** Bodenrisiko-Minderungen aus Step #3 - nur die Robustheiten, die Table 5 kennt. */
export interface GrcMinderungen {
  m1a: 'L' | 'M' | null; // strategisch: Abschirmung durch Gebäude (Sheltering)
  m1b: 'M' | 'H' | null; // strategisch: betriebliche Einschränkungen
  m1c: 'L' | null;       // taktisch: Bodenbeobachtung
  m2: 'M' | 'H' | null;  // Aufprallwirkung verringert, z. B. Fallschirm
}
export const KEINE_MINDERUNG: GrcMinderungen = { m1a: null, m1b: null, m1c: null, m2: null };

// Table 5 (S. 29): Abzug je Robustheit, fehlende Stufen sind dort „n/a“.
const MINDERUNG_ABZUG = {
  m1a: { L: 1, M: 2 },
  m1b: { M: 1, H: 2 },
  m1c: { L: 1 },
  m2: { M: 1, H: 2 },
} as const;

export type MinderungsWarnung = 'm1a-mittel-mit-m1b' | 'm1a-ueber-ansammlung';

export interface GrcBerechnung {
  finalGrc: number;
  /** Tatsächlich angerechneter Abzug (nach Untergrenze). */
  abzug: number;
  warnungen: MinderungsWarnung[];
}

/** Finaler GRC: Minderungen in Reihenfolge M1(A), M1(B), M1(C), M2, nicht unter
 *  den Wert für kontrollierten Bodenbereich derselben Spalte (und nicht unter 1). */
export function berechneFinalGrc(igrc: IgrcBestimmung, m: GrcMinderungen): GrcBerechnung | null {
  if (igrc.wert === null) return null;
  const warnungen: MinderungsWarnung[] = [];
  let m1a = m.m1a;
  let m1b = m.m1b;
  if (m1a && igrc.bevoelkerung === 'ueber50000') {
    warnungen.push('m1a-ueber-ansammlung');
    m1a = null;
  }
  if (m1a === 'M' && m1b) {
    warnungen.push('m1a-mittel-mit-m1b');
    m1b = null;
  }
  const summe = (m1a ? MINDERUNG_ABZUG.m1a[m1a] : 0)
    + (m1b ? MINDERUNG_ABZUG.m1b[m1b] : 0)
    + (m.m1c ? MINDERUNG_ABZUG.m1c[m.m1c] : 0)
    + (m.m2 ? MINDERUNG_ABZUG.m2[m.m2] : 0);
  const boden = igrc.spalte === null ? 1 : IGRC_TABELLE.kontrolliert[igrc.spalte] ?? 1;
  const untergrenze = Math.min(igrc.wert, Math.max(1, boden));
  const finalGrc = Math.max(untergrenze, igrc.wert - summe);
  return { finalGrc, abzug: igrc.wert - finalGrc, warnungen };
}

export interface SoraInput {
  operationTitle: string;
  visibility: FlightVisibility;
  airspace: AirspaceCategory;
  maxAltitudeM: number;
  droneMtomKg: number;
  /** Größte charakteristische Abmessung in m (Multikopter: Diagonale Blattspitze zu Blattspitze). */
  abmessungM: number;
  /** Höchste mögliche kommandierte Geschwindigkeit laut Hersteller, m/s. */
  geschwindigkeitMs: number;
  bevoelkerung: Bevoelkerung;
  /** Luftrisiko: Flug über städtischem Gebiet (SORA unterscheidet urban/rural). */
  ueberStadt: boolean;
  minderungen: GrcMinderungen;
}

export interface OsoAnforderung {
  nummer: string;
  robustheit: Robustheit;
  titel: string;
  titelEn: string;
}

export interface SoraResult {
  igrc: IgrcBestimmung;
  initialGrc: number | null;
  /** Angerechneter GRC-Abzug durch Minderungen. */
  grcAbzug: number;
  finalGrc: number | null;
  warnungen: MinderungsWarnung[];
  initialArc: Arc;
  finalArc: Arc;
  /** null, wenn kein SAIL bestimmbar ist (außerhalb SORA oder außerhalb der Tabelle). */
  sail: Sail | null;
  /** Graue Tabellenzelle oder finaler GRC über 7: außerhalb von SORA, zulassungspflichtige Kategorie. */
  ausserhalbSora: boolean;
  requiredOsos: OsoAnforderung[];
}

/** Luftrisiko (vereinfachte Begegnungskategorien): Flughafen und Sperrgebiet
 *  ARC-d; kontrolliert ARC-c, oberhalb 120 m ARC-d; unkontrolliert unter 120 m
 *  über Land ARC-b, über Stadt ARC-c, darüber ARC-c. */
export function calculateInitialArc(airspace: AirspaceCategory, altitudeM: number, ueberStadt = false): Arc {
  if (airspace === 'prohibited' || airspace === 'airport') return 'ARC-d';
  if (airspace === 'controlled') return altitudeM > 120 ? 'ARC-d' : 'ARC-c';
  if (altitudeM > 120) return 'ARC-c';
  return ueberStadt ? 'ARC-c' : 'ARC-b';
}

// SAIL-Matrix (JARUS SORA 2.5, Step #7): Zeilen finaler GRC ≤2 … 7,
// Spalten verbleibende ARC a-d.
const SAIL_MATRIX: Sail[][] = [
  ['SAIL I', 'SAIL II', 'SAIL IV', 'SAIL VI'],
  ['SAIL II', 'SAIL II', 'SAIL IV', 'SAIL VI'],
  ['SAIL III', 'SAIL III', 'SAIL IV', 'SAIL VI'],
  ['SAIL IV', 'SAIL IV', 'SAIL IV', 'SAIL VI'],
  ['SAIL V', 'SAIL V', 'SAIL V', 'SAIL VI'],
  ['SAIL VI', 'SAIL VI', 'SAIL VI', 'SAIL VI'],
];
const ARC_SPALTE: Record<Arc, number> = { 'ARC-a': 0, 'ARC-b': 1, 'ARC-c': 2, 'ARC-d': 3 };
const SAIL_STUFEN: Sail[] = ['SAIL I', 'SAIL II', 'SAIL III', 'SAIL IV', 'SAIL V', 'SAIL VI'];

/** SAIL aus finalem GRC (1 … 7) und verbleibender ARC. Ein GRC über 7 liegt
 *  außerhalb von SORA - das prüft evaluateSora vorher. */
export function determineSail(finalGrc: number, arc: Arc): Sail {
  const zeile = Math.min(Math.max(finalGrc, 2), 7) - 2;
  return SAIL_MATRIX[zeile][ARC_SPALTE[arc]];
}

type Stufe = Robustheit | null; // null = nicht erforderlich (NR)

// OSO-Tabelle aus SORA 2.5 (EASA-Übersicht 2023): Nummern nach SORA 2.0
// (zusammengelegte OSOs unter der ersten Nummer), Robustheit für SAIL I … VI.
const OSO_TABELLE: { nummer: string; titel: string; titelEn: string; stufen: Stufe[] }[] = [
  { nummer: 'OSO #01', titel: 'Betreiber ist kompetent und/oder nachweislich erfahren', titelEn: 'Ensure the UAS operator is competent and/or proven', stufen: [null, 'L', 'M', 'H', 'H', 'H'] },
  { nummer: 'OSO #02', titel: 'UAS von kompetentem und/oder erfahrenem Hersteller gebaut', titelEn: 'UAS manufactured by competent and/or proven entity', stufen: [null, null, 'L', 'M', 'H', 'H'] },
  { nummer: 'OSO #17', titel: 'Fernpiloten-Team ist einsatzfähig', titelEn: 'Remote crew is fit to operate', stufen: ['L', 'L', 'M', 'M', 'H', 'H'] },
  { nummer: 'OSO #08', titel: 'Betriebsverfahren sind festgelegt, validiert und werden eingehalten (inkl. Notfallplan)', titelEn: 'Operational procedures are defined, validated and adhered to (incl. emergency response plan)', stufen: ['L', 'M', 'H', 'H', 'H', 'H'] },
  { nummer: 'OSO #03', titel: 'UAS wird von kompetenter und/oder erfahrener Stelle gewartet', titelEn: 'UAS maintained by competent and/or proven entity', stufen: ['L', 'L', 'M', 'M', 'H', 'H'] },
  { nummer: 'OSO #07', titel: 'Prüfung des UAS (Produktinspektion) auf Übereinstimmung mit dem ConOps', titelEn: 'Inspection of the UAS (product inspection) to ensure consistency with the ConOps', stufen: ['L', 'L', 'M', 'M', 'H', 'H'] },
  { nummer: 'OSO #23', titel: 'Umgebungsbedingungen für den sicheren Betrieb sind festgelegt, messbar und werden eingehalten', titelEn: 'Environmental conditions for safe operations are defined, measurable and adhered to', stufen: ['L', 'L', 'M', 'M', 'H', 'H'] },
  { nummer: 'OSO #13', titel: 'Externe Dienste, die den Betrieb unterstützen, sind angemessen', titelEn: 'External services supporting UAS operations are adequate for the operation', stufen: ['L', 'L', 'M', 'H', 'H', 'H'] },
  { nummer: 'OSO #16', titel: 'Koordination im Team mit mehreren Personen', titelEn: 'Multi-crew coordination', stufen: ['L', 'L', 'M', 'M', 'H', 'H'] },
  { nummer: 'OSO #09', titel: 'Fernpiloten-Team ist geschult, in Übung und beherrscht ungewöhnliche Situationen', titelEn: 'Remote crew trained and current and able to control the abnormal situation', stufen: ['L', 'L', 'M', 'M', 'H', 'H'] },
  { nummer: 'OSO #19', titel: 'Sicheres Beherrschen menschlicher Fehler', titelEn: 'Safe recovery from human error', stufen: [null, null, 'L', 'M', 'M', 'H'] },
  { nummer: 'OSO #04', titel: 'UAS nach behördlich anerkannten Konstruktionsstandards entwickelt', titelEn: 'UAS developed to authority recognised design standards', stufen: [null, null, null, 'L', 'M', 'H'] },
  { nummer: 'OSO #05', titel: 'UAS unter Berücksichtigung von Systemsicherheit und Zuverlässigkeit ausgelegt', titelEn: 'UAS is designed considering system safety and reliability', stufen: [null, null, 'L', 'M', 'H', 'H'] },
  { nummer: 'OSO #18', titel: 'Automatischer Schutz der Flugenveloppe vor menschlichen Fehlern', titelEn: 'Automatic protection of the flight envelope from human error', stufen: [null, null, 'L', 'M', 'H', 'H'] },
  { nummer: 'OSO #20', titel: 'Human-Factors-Bewertung durchgeführt, Bedienoberfläche für die Mission geeignet', titelEn: 'A human factors evaluation has been performed and the HMI found appropriate for the mission', stufen: [null, 'L', 'L', 'M', 'M', 'H'] },
  { nummer: 'OSO #06', titel: 'Leistung der C3-Verbindung ist für den Betrieb geeignet', titelEn: 'C3 link performance is appropriate for the operation', stufen: [null, 'L', 'L', 'M', 'H', 'H'] },
  { nummer: 'OSO #24', titel: 'UAS für widrige Umgebungsbedingungen ausgelegt und qualifiziert', titelEn: 'UAS is designed and qualified for adverse environmental conditions', stufen: [null, null, 'M', 'H', 'H', 'H'] },
  { nummer: 'OSO #10', titel: 'Sicheres Beherrschen technischer Probleme', titelEn: 'Safe recovery from a technical issue', stufen: ['L', 'L', 'M', 'M', 'H', 'H'] },
];

/** Erforderliche OSOs mit Robustheit für einen SAIL (nicht erforderliche entfallen). */
export function osoFuerSail(sail: Sail): OsoAnforderung[] {
  const stufe = SAIL_STUFEN.indexOf(sail);
  return OSO_TABELLE.flatMap(({ stufen, ...oso }) => {
    const robustheit = stufen[stufe];
    return robustheit ? [{ ...oso, robustheit }] : [];
  });
}

export function evaluateSora(input: SoraInput): SoraResult {
  const igrc = bestimmeIgrc(input.abmessungM, input.geschwindigkeitMs, input.bevoelkerung, input.droneMtomKg);
  const grc = berechneFinalGrc(igrc, input.minderungen);
  const finalGrc = grc?.finalGrc ?? null;

  const initialArc = calculateInitialArc(input.airspace, input.maxAltitudeM, input.ueberStadt);
  const finalArc = initialArc; // ohne taktische Minderung des Luftrisikos
  const ausserhalbSora = igrc.quelle === 'graue-zelle' || (finalGrc !== null && finalGrc > 7);
  const sail = finalGrc === null || ausserhalbSora ? null : determineSail(finalGrc, finalArc);

  return {
    igrc,
    initialGrc: igrc.wert,
    grcAbzug: grc?.abzug ?? 0,
    finalGrc,
    warnungen: grc?.warnungen ?? [],
    initialArc,
    finalArc,
    sail,
    ausserhalbSora,
    requiredOsos: sail ? osoFuerSail(sail) : [],
  };
}

const ROBUSTHEIT_TEXT: Record<Robustheit, string> = { L: 'niedrig', M: 'mittel', H: 'hoch' };
const ROBUSTHEIT_TEXT_EN: Record<Robustheit, string> = { L: 'low', M: 'medium', H: 'high' };

/** Robustheit lesbar, z. B. „mittel“ / „medium“. */
export function robustheitText(r: Robustheit, sprache: 'de' | 'en' = 'de'): string {
  return (sprache === 'en' ? ROBUSTHEIT_TEXT_EN : ROBUSTHEIT_TEXT)[r];
}

/** Zeilenbeschriftung mit der qualitativen Beschreibung aus Table 2 (S. 26). */
const BEVOELKERUNG_TEXT: Record<Bevoelkerung, [string, string]> = {
  kontrolliert: ['Kontrollierter Bodenbereich (nur Beteiligte)', 'Controlled ground area (involved persons only)'],
  unter5: ['< 5 Pers./km² - abgelegen (Wald, große Felder)', '< 5 people/km² - remote (forests, large farm parcels)'],
  unter50: ['< 50 Pers./km² - schwach besiedelt (kleine Höfe)', '< 50 people/km² - lightly populated (small farms)'],
  unter500: ['< 500 Pers./km² - dünn besiedelt, große Grundstücke', '< 500 people/km² - sparsely populated, large lots'],
  unter5000: ['< 5.000 Pers./km² - Vorort, Wohngebiet', '< 5,000 people/km² - suburban, residential'],
  unter50000: ['< 50.000 Pers./km² - dicht bebaute Innenstadt', '< 50,000 people/km² - high-density metropolitan'],
  ueber50000: ['> 50.000 Pers./km² - Menschenansammlungen', '> 50,000 people/km² - assemblies of people'],
};

export function bevoelkerungText(b: Bevoelkerung, sprache: 'de' | 'en' = 'de'): string {
  return BEVOELKERUNG_TEXT[b][sprache === 'en' ? 1 : 0];
}

const QUELLE = 'EASA AMC1 Art. 11 (SORA 2.5), ED Decision 2025/018/R';

/** Woher der iGRC kommt - für Dialog und PDF. */
export function igrcQuelle(b: IgrcBestimmung, sprache: 'de' | 'en' = 'de'): string {
  const en = sprache === 'en';
  const s = b.spalte === null ? null : IGRC_SPALTEN[b.spalte];
  const spalte = s ? `${s.abmessungM} m / ${s.geschwindigkeitMs} m/s` : '';
  const zeile = bevoelkerungText(b.bevoelkerung, sprache).split(' - ')[0];
  switch (b.quelle) {
    case 'regel-250g':
      return en
        ? `250 g rule: at most 250 g and 25 m/s, not over assemblies of people (${QUELLE}, Table 1, p. 24)`
        : `250-g-Regel: höchstens 250 g und 25 m/s, nicht über Menschenansammlungen (${QUELLE}, Table 1, S. 24)`;
    case 'tabelle':
      return en
        ? `Table 1, column ${spalte}, row ${zeile} (${QUELLE}, p. 24)`
        : `Table 1, Spalte ${spalte}, Zeile ${zeile} (${QUELLE}, S. 24)`;
    case 'graue-zelle':
      return en
        ? `Grey cell in Table 1 (column ${spalte}, row ${zeile}): not part of SORA - consider the certified category (${QUELLE}, pp. 24-25)`
        : `Graue Zelle in Table 1 (Spalte ${spalte}, Zeile ${zeile}): nicht Teil von SORA - zulassungspflichtige Kategorie prüfen (${QUELLE}, S. 24-25)`;
    case 'ausserhalb-tabelle':
      return en
        ? `Above 40 m or 200 m/s: not covered by Table 1 - determine the iGRC with Annex F / the authority (${QUELLE}, p. 24)`
        : `Über 40 m oder 200 m/s: von Table 1 nicht abgedeckt - iGRC nach Annex F bzw. mit der Behörde bestimmen (${QUELLE}, S. 24)`;
  }
}

const WARNUNG_TEXT: Record<MinderungsWarnung, [string, string]> = {
  'm1a-mittel-mit-m1b': ['M1(A) mittel lässt sich nicht mit M1(B) kombinieren - M1(B) wird nicht angerechnet.', 'M1(A) medium cannot be combined with M1(B) - M1(B) is not credited.'],
  'm1a-ueber-ansammlung': ['M1(A) gilt nicht über Menschenansammlungen - wird nicht angerechnet.', 'M1(A) cannot be claimed over assemblies of people - not credited.'],
};

export function warnungText(w: MinderungsWarnung, sprache: 'de' | 'en' = 'de'): string {
  return WARNUNG_TEXT[w][sprache === 'en' ? 1 : 0];
}

/** Angewandte Minderungen kurz, z. B. „M1(A) niedrig, M2 mittel“. */
export function minderungenText(m: GrcMinderungen, sprache: 'de' | 'en' = 'de'): string {
  const teile = ([['M1(A)', m.m1a], ['M1(B)', m.m1b], ['M1(C)', m.m1c], ['M2', m.m2]] as const)
    .filter(([, r]) => r)
    .map(([name, r]) => `${name} ${robustheitText(r as Robustheit, sprache)}`);
  return teile.length ? teile.join(', ') : (sprache === 'en' ? 'none' : 'keine');
}

/** Einordnung für Dialog und PDF. */
export const HINWEIS = 'Vorabschätzung nach SORA 2.5: Boden-Risikowert (iGRC), Minderungen und finaler GRC nach EASA AMC1 Art. 11 (ED Decision 2025/018/R), SAIL-Matrix und OSO-Robustheit laut EASA-Übersicht 2023. Das Luftrisiko ist vereinfacht und ohne Minderung angesetzt; die Minderungen gelten nur mit Nachweis nach Annex B. Für den Antrag mit dem aktuellen JARUS-/EASA-Dokument abgleichen.';
export const HINWEIS_EN = 'Preliminary estimate based on SORA 2.5: ground risk class (iGRC), mitigations and final GRC according to EASA AMC1 Art. 11 (ED Decision 2025/018/R), SAIL matrix and OSO robustness according to the EASA overview 2023. The air risk is simplified and without mitigation; mitigations only count with evidence according to Annex B. Check against the current JARUS/EASA document for the application.';

export async function generateSoraPdf(
  input: SoraInput,
  result: SoraResult,
  drone: Drone | null,
  profile: UserProfile | null
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(30, 58, 138); // brand-blue
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('EASA SORA 2.5 — ConOps & Risikobeurteilung', 15, 17);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Betriebskategorie: Spezifisch (Specific Category) · Datum: ${new Date().toLocaleDateString('de-DE')}`, 15, 25);

  // Applicant Box
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Antragsteller & Betreiberdaten', 15, 42);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Betreiber: ${profile?.name || 'Unbekannt'}`, 15, 49);
  doc.text(`LBA e-ID: ${profile?.eid || 'Nicht angegeben'}`, 15, 54);
  doc.text(`Betriebskonzept: ${input.operationTitle}`, 15, 59);

  // Aircraft & ConOps
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. UAS & Flugparametrierung', 120, 42);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Unbemanntes Luftfahrzeug: ${drone?.model || 'Generic UAS'}`, 120, 49);
  doc.text(`Abflugmasse (MTOM): ${input.droneMtomKg} kg`, 120, 54);
  doc.text(`Charakt. Abmessung: ${input.abmessungM} m`, 120, 59);
  doc.text(`Höchstgeschwindigkeit: ${input.geschwindigkeitMs} m/s`, 120, 64);
  doc.text(`Maximale Flughöhe: ${input.maxAltitudeM} m AGL`, 120, 69);

  // SORA Evaluation Matrix Table
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 76, 180, 66, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('SORA 2.5 Risikomatrix Bewertungsergebnis', 20, 85);

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Initial Ground Risk Class (iGRC): ${result.initialGrc ?? 'nicht bestimmbar'}`, 20, 94);
  doc.text(`Minderungen: ${minderungenText(input.minderungen)} (-${result.grcAbzug} GRC)`, 20, 101);
  doc.text(`Final Ground Risk Class (Final GRC): ${result.finalGrc ?? 'nicht bestimmbar'}`, 20, 108);

  doc.text(`Air Risk Class (ARC): ${result.finalArc}`, 125, 94);
  doc.text(`Luftraumklasse: ${input.airspace.toUpperCase()}`, 125, 101);

  // Highlighting SAIL LEVEL
  doc.setFillColor(30, 58, 138);
  doc.rect(125, 104, 65, 11, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const ergebnis = result.ausserhalbSora ? 'außerhalb SORA' : result.sail ?? 'nicht bestimmbar';
  doc.text(`ERGEBNIS: ${ergebnis}`, 128, 111.5);

  // Herkunft des iGRC
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  let y = 121;
  const herkunft: string[] = doc.splitTextToSize(
    `Bevölkerungsdichte: ${bevoelkerungText(input.bevoelkerung)}. iGRC-Quelle: ${igrcQuelle(result.igrc)}`, 170);
  herkunft.forEach(zeile => {
    doc.text(zeile, 20, y);
    y += 4;
  });
  result.warnungen.forEach(w => {
    doc.text(warnungText(w), 20, y);
    y += 4;
  });

  // OSOs
  y = Math.max(y + 6, 150);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Erforderliche Operational Safety Objectives (OSOs)', 15, y);

  y += 8;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  if (result.ausserhalbSora) {
    doc.text('Außerhalb von SORA (graue Tabellenzelle oder finaler GRC über 7) - zulassungspflichtige Kategorie (certified).', 18, y);
    y += 7;
  } else if (!result.sail) {
    doc.text('Kein SAIL bestimmbar: iGRC liegt außerhalb der Tabelle (Annex F bzw. Behörde).', 18, y);
    y += 7;
  }
  result.requiredOsos.forEach(oso => {
    const zeilen: string[] = doc.splitTextToSize(`• ${oso.nummer} (Robustheit ${robustheitText(oso.robustheit)}): ${oso.titel}`, 177);
    if (y + zeilen.length * 4.5 > 280) {
      doc.addPage();
      y = 20;
    }
    zeilen.forEach((zeile, i) => {
      doc.text(zeile, i === 0 ? 18 : 21, y);
      y += 4.5;
    });
    y += 1.5;
  });

  // Einordnung: vereinfachte Vorabschätzung
  y += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const hinweis: string[] = doc.splitTextToSize(HINWEIS, 177);
  if (y + hinweis.length * 4 > 280) {
    doc.addPage();
    y = 20;
  }
  hinweis.forEach(zeile => {
    doc.text(zeile, 15, y);
    y += 4;
  });

  // Authority Signature
  y = Math.max(y + 15, 245);
  if (y > 275) {
    doc.addPage();
    y = 245;
  }
  doc.setDrawColor(203, 213, 225);
  doc.line(15, y, 90, y);
  doc.line(115, y, 185, y);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Unterschrift Antragsteller', 15, y + 4);
  doc.text('Prüfvermerk der Luftfahrtbehörde (LBA / BAZL / AC)', 115, y + 4);

  const dateiTeil = result.sail ? result.sail.replace(/\s+/g, '_') : result.ausserhalbSora ? 'ausserhalb_SORA' : 'ohne_SAIL';
  doc.save(`skylog_sora25_dossier_${dateiTeil}.pdf`);
}
