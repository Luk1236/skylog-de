import type { UserProfile, Drone } from './db';

// SORA-Vorabschätzung für die spezifische Kategorie.
//
// Belegt nach JARUS SORA 2.5 / EASA-Übersicht (2023): SAIL-Matrix, OSO-Tabelle
// mit Robustheit je SAIL, Wegfall von M3 (der Notfallplan steckt jetzt in
// OSO #08), die 250-g-Regel und die Unterscheidung Stadt/Land beim
// Luftrisiko unter 150 m.
// Bewusst vereinfacht: Der Boden-Risikowert (iGRC) kommt hier grob aus
// Abflugmasse und Umgebung - SORA 2.5 nimmt Spannweite, Geschwindigkeit und
// Bevölkerungsdichte. M1/M2 zählen pauschal je -1. Das Ergebnis ist eine
// Orientierung, kein Ersatz für die Bewertung im Antrag.

export type OperationEnvironment = 'controlled' | 'sparse' | 'populated' | 'assembly';
export type FlightVisibility = 'vlos' | 'bvlos';
export type AirspaceCategory = 'uncontrolled' | 'controlled' | 'airport' | 'prohibited';
export type Arc = 'ARC-a' | 'ARC-b' | 'ARC-c' | 'ARC-d';
export type Sail = 'SAIL I' | 'SAIL II' | 'SAIL III' | 'SAIL IV' | 'SAIL V' | 'SAIL VI';
/** Robustheit eines OSO: niedrig, mittel, hoch. */
export type Robustheit = 'L' | 'M' | 'H';

export interface SoraInput {
  operationTitle: string;
  environment: OperationEnvironment;
  visibility: FlightVisibility;
  airspace: AirspaceCategory;
  maxAltitudeM: number;
  droneMtomKg: number;
  m1Mitigation: boolean; // Strategische Minderung am Boden (-1 GRC)
  m2Mitigation: boolean; // Aufprallminderung, z. B. Fallschirm (-1 GRC)
}

export interface OsoAnforderung {
  nummer: string;
  robustheit: Robustheit;
  titel: string;
  titelEn: string;
}

export interface SoraResult {
  initialGrc: number;
  finalGrc: number;
  initialArc: Arc;
  finalArc: Arc;
  sail: Sail;
  /** Finaler GRC über 7: außerhalb von SORA, zulassungspflichtige Kategorie. */
  ausserhalbSora: boolean;
  requiredOsos: OsoAnforderung[];
}

export function calculateInitialGrc(env: OperationEnvironment, mtom: number): number {
  // SORA 2.5: Bis 250 g (und höchstens 25 m/s) gilt iGRC 1 - außer über
  // Menschenansammlungen.
  if (mtom <= 0.25 && env !== 'assembly') return 1;
  if (env === 'controlled') {
    if (mtom <= 1) return 1;
    if (mtom <= 4) return 2;
    return 3;
  }
  if (env === 'sparse') {
    if (mtom <= 1) return 2;
    if (mtom <= 4) return 3;
    return 4;
  }
  if (env === 'populated') {
    if (mtom <= 1) return 4;
    if (mtom <= 4) return 5;
    return 6;
  }
  // Menschenansammlungen
  if (mtom <= 1) return 6;
  if (mtom <= 4) return 7;
  return 8;
}

/** Luftrisiko (vereinfachte Begegnungskategorien): Flughafen und Sperrgebiet
 *  ARC-d; kontrolliert ARC-c, oberhalb 120 m ARC-d; unkontrolliert unter 120 m
 *  über Land ARC-b, über besiedeltem Gebiet ARC-c, darüber ARC-c. */
export function calculateInitialArc(airspace: AirspaceCategory, altitudeM: number, env: OperationEnvironment = 'sparse'): Arc {
  if (airspace === 'prohibited' || airspace === 'airport') return 'ARC-d';
  if (airspace === 'controlled') return altitudeM > 120 ? 'ARC-d' : 'ARC-c';
  if (altitudeM > 120) return 'ARC-c';
  const stadt = env === 'populated' || env === 'assembly';
  return stadt ? 'ARC-c' : 'ARC-b';
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

/** SAIL aus finalem GRC und verbleibender ARC. Ein GRC über 7 liegt außerhalb
 *  von SORA - hier dann SAIL VI, evaluateSora setzt zusätzlich ausserhalbSora. */
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
  const initialGrc = calculateInitialGrc(input.environment, input.droneMtomKg);
  let finalGrc = initialGrc;
  if (input.m1Mitigation) finalGrc = Math.max(1, finalGrc - 1);
  if (input.m2Mitigation) finalGrc = Math.max(1, finalGrc - 1);

  const initialArc = calculateInitialArc(input.airspace, input.maxAltitudeM, input.environment);
  const finalArc = initialArc; // ohne taktische Minderung des Luftrisikos
  const sail = determineSail(finalGrc, finalArc);

  return {
    initialGrc,
    finalGrc,
    initialArc,
    finalArc,
    sail,
    ausserhalbSora: finalGrc > 7,
    requiredOsos: osoFuerSail(sail),
  };
}

const ROBUSTHEIT_TEXT: Record<Robustheit, string> = { L: 'niedrig', M: 'mittel', H: 'hoch' };
const ROBUSTHEIT_TEXT_EN: Record<Robustheit, string> = { L: 'low', M: 'medium', H: 'high' };

/** Robustheit lesbar, z. B. „mittel“ / „medium“. */
export function robustheitText(r: Robustheit, sprache: 'de' | 'en' = 'de'): string {
  return (sprache === 'en' ? ROBUSTHEIT_TEXT_EN : ROBUSTHEIT_TEXT)[r];
}

/** Einordnung für Dialog und PDF. */
export const HINWEIS = 'Vorabschätzung nach SORA 2.5 (SAIL-Matrix und OSO-Robustheit laut EASA-Übersicht 2023). Der Boden-Risikowert ist vereinfacht aus Abflugmasse und Umgebung bestimmt. Für den Antrag mit dem aktuellen JARUS-/EASA-Dokument abgleichen.';
export const HINWEIS_EN = 'Preliminary estimate based on SORA 2.5 (SAIL matrix and OSO robustness according to the EASA overview 2023). The ground risk class is simplified from take-off mass and environment. Check against the current JARUS/EASA document for the application.';

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
  doc.text(`Maximale Flughöhe: ${input.maxAltitudeM} m AGL`, 120, 59);

  // SORA Evaluation Matrix Table
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 68, 180, 50, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('SORA 2.5 Risikomatrix Bewertungsergebnis', 20, 77);

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Initial Ground Risk Class (iGRC): ${result.initialGrc}`, 20, 86);
  doc.text(`Minderungen (M1/M2): -${result.initialGrc - result.finalGrc} GRC`, 20, 93);
  doc.text(`Final Ground Risk Class (Final GRC): ${result.finalGrc}`, 20, 100);

  doc.text(`Air Risk Class (ARC): ${result.finalArc}`, 115, 86);
  doc.text(`Luftraumklasse: ${input.airspace.toUpperCase()}`, 115, 93);

  // Highlighting SAIL LEVEL
  doc.setFillColor(30, 58, 138);
  doc.rect(115, 98, 70, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(result.ausserhalbSora ? 'ERGEBNIS: außerhalb SORA' : `ERGEBNIS: ${result.sail}`, 120, 107);

  // OSOs
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Erforderliche Operational Safety Objectives (OSOs)', 15, 128);

  let y = 136;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  if (result.ausserhalbSora) {
    doc.text('Finaler GRC über 7: außerhalb von SORA - zulassungspflichtige Kategorie (certified).', 18, y);
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

  doc.save(`skylog_sora25_dossier_${result.sail.replace(/\s+/g, '_')}.pdf`);
}
