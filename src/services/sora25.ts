import type { UserProfile, Drone } from './db';

export type OperationEnvironment = 'controlled' | 'sparse' | 'populated' | 'assembly';
export type FlightVisibility = 'vlos' | 'bvlos';
export type AirspaceCategory = 'uncontrolled' | 'controlled' | 'airport' | 'prohibited';

export interface SoraInput {
  operationTitle: string;
  environment: OperationEnvironment;
  visibility: FlightVisibility;
  airspace: AirspaceCategory;
  maxAltitudeM: number;
  droneMtomKg: number;
  m1Mitigation: boolean; // Strategic ground isolation (-1 GRC)
  m2Mitigation: boolean; // Parachute / impact reduction (-1 GRC)
  m3Mitigation: boolean; // Validated ERP (-1 GRC)
}

export interface SoraResult {
  initialGrc: number;
  finalGrc: number;
  initialArc: 'ARC-a' | 'ARC-b' | 'ARC-c' | 'ARC-d';
  finalArc: 'ARC-a' | 'ARC-b' | 'ARC-c' | 'ARC-d';
  sail: 'SAIL I' | 'SAIL II' | 'SAIL III' | 'SAIL IV' | 'SAIL V' | 'SAIL VI';
  requiredOsos: string[];
}

export function calculateInitialGrc(env: OperationEnvironment, mtom: number): number {
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
  // Assemblies of people
  if (mtom <= 1) return 6;
  if (mtom <= 4) return 7;
  return 8;
}

export function calculateInitialArc(airspace: AirspaceCategory, altitudeM: number): 'ARC-a' | 'ARC-b' | 'ARC-c' | 'ARC-d' {
  if (airspace === 'prohibited' || airspace === 'airport') return 'ARC-d';
  if (airspace === 'controlled') return altitudeM > 120 ? 'ARC-d' : 'ARC-c';
  // Uncontrolled
  return altitudeM <= 120 ? 'ARC-b' : 'ARC-c';
}

export function determineSail(finalGrc: number, arc: string): 'SAIL I' | 'SAIL II' | 'SAIL III' | 'SAIL IV' | 'SAIL V' | 'SAIL VI' {
  if (finalGrc <= 2 && arc === 'ARC-a') return 'SAIL I';
  if (finalGrc <= 3 && (arc === 'ARC-a' || arc === 'ARC-b')) return 'SAIL II';
  if (finalGrc <= 4 && arc <= 'ARC-c') return 'SAIL III';
  if (finalGrc <= 5 && arc <= 'ARC-c') return 'SAIL IV';
  if (finalGrc <= 6 && arc <= 'ARC-d') return 'SAIL V';
  return 'SAIL VI';
}

export function evaluateSora(input: SoraInput): SoraResult {
  const initialGrc = calculateInitialGrc(input.environment, input.droneMtomKg);
  let finalGrc = initialGrc;

  if (input.m1Mitigation) finalGrc = Math.max(1, finalGrc - 1);
  if (input.m2Mitigation) finalGrc = Math.max(1, finalGrc - 1);
  if (input.m3Mitigation) finalGrc = Math.max(1, finalGrc - 1);

  const initialArc = calculateInitialArc(input.airspace, input.maxAltitudeM);
  const finalArc = initialArc; // Assumes no tactical deconfliction downgrade for baseline

  const sail = determineSail(finalGrc, finalArc);

  const requiredOsos = [
    'OSO #01: Organisatorisches Sicherheitsmanagementsystem (SMS)',
    'OSO #02: Wartungskonzept für UAS & Komponenten nachgewiesen',
    'OSO #03: Inspektion & Pre-Flight Checklisten verifiziert',
    'OSO #04: Fernpiloten-Schulung & Lizenzierung (A1/A3, A2 oder STS)',
    'OSO #05: Ausfallsicheres C2-Link Verbindungsprotokoll',
    'OSO #06: Notfall-Standardverfahren (ERP & Safe Return Home)',
  ];

  if (sail >= 'SAIL III') {
    requiredOsos.push(
      'OSO #07: Robuste Hardware-Redundanz & Geofencing-Modul',
      'OSO #08: Erweiterte Meteorologische Limits & Wind-Monitoring'
    );
  }

  return {
    initialGrc,
    finalGrc,
    initialArc,
    finalArc,
    sail,
    requiredOsos,
  };
}

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
  doc.text(`Mitigations (M1/M2/M3): -${result.initialGrc - result.finalGrc} GRC`, 20, 93);
  doc.text(`Final Ground Risk Class (Final GRC): ${result.finalGrc}`, 20, 100);

  doc.text(`Air Risk Class (ARC): ${result.finalArc}`, 115, 86);
  doc.text(`Luftraumklasse: ${input.airspace.toUpperCase()}`, 115, 93);

  // Highlighting SAIL LEVEL
  doc.setFillColor(30, 58, 138);
  doc.rect(115, 98, 70, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`ERGEBNIS: ${result.sail}`, 120, 107);

  // OSOs
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Erforderliche Operational Safety Objectives (OSOs)', 15, 128);

  let y = 136;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  result.requiredOsos.forEach(oso => {
    doc.text(`• ${oso}`, 18, y);
    y += 6;
  });

  // Authority Signature
  y = Math.max(y + 15, 245);
  doc.setDrawColor(203, 213, 225);
  doc.line(15, y, 90, y);
  doc.line(115, y, 185, y);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Unterschrift Antragsteller', 15, y + 4);
  doc.text('Prüfvermerk der Luftfahrtbehörde (LBA / BAZL / AC)', 115, y + 4);

  doc.save(`skylog_sora25_dossier_${result.sail.replace(/\s+/g, '_')}.pdf`);
}
