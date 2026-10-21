import type { Drone, Flight, UserProfile } from '../../services/db';
import { fluegeImZeitraum, betriebsnachweis, pdfTabellenzeilen, baueCsv, baueKml } from '../../services/reportExport';

// Datei-Exporte des Logbuchs. Voll-Backup (JSON) liegt bewusst nur in den
// Einstellungen: dort filtert backup.ts die NOTAM-Zugangsdaten heraus. Ein
// zweiter, ungefilterter Weg hier hätte die Geheimnisse doch in die Datei
// geschrieben. Hier bleiben nur flug-spezifische Exporte (PDF, CSV, KML).

const heute = () => new Date().toISOString().split('T')[0];

function herunterladen(inhalt: string, typ: string, name: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  link.download = name;
  link.click();
}

export function exportiereCsv(fluege: Flight[], drones: Drone[], pilot?: string) {
  herunterladen(baueCsv(fluege, drones, pilot), 'text/csv;charset=utf-8;', `skylog_export_${heute()}.csv`);
}

export function exportiereKml(fluege: Flight[]) {
  herunterladen(baueKml(fluege), 'application/vnd.google-earth.kml+xml', `skylog_fluggebiete_${heute()}.kml`);
}

/** Betriebsnachweis als PDF: Pilot, Summen und Flugtabelle für ein Jahr oder alle. */
export async function exportierePdf(alleFluege: Flight[], drones: Drone[], profile: UserProfile | null, jahr: string) {
  // PDF-Bibliotheken erst bei Bedarf nachladen (rund 400 kB).
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();

  const fluege = fluegeImZeitraum(alleFluege, jahr);
  const zeitraum = jahr === 'alle' ? 'Gesamt' : jahr;
  const b = betriebsnachweis(fluege);

  doc.setFontSize(22);
  doc.setTextColor(30, 58, 138); // Markenblau
  doc.text(`Fluglogbuch & Betriebsnachweis ${jahr === 'alle' ? '' : jahr}`.trim(), 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generiert am: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}`, 14, 30);

  doc.setFontSize(14);
  doc.setTextColor(50);
  doc.text('Piloten-Informationen', 14, 45);

  doc.setFontSize(10);
  doc.text(`Name: ${profile?.name || 'Nicht angegeben'}`, 14, 52);
  doc.text(`LBA e-ID: ${profile?.eid || 'Nicht angegeben'}`, 14, 57);
  doc.text(`Lizenz: ${profile?.licenseType || 'Keine'}`, 80, 52);
  doc.text(`Versicherung: ${profile?.insuranceNumber || 'Nicht angegeben'}`, 80, 57);

  // Summen über den gewählten Zeitraum
  doc.setFontSize(14);
  doc.setTextColor(50);
  doc.text(`Betriebsnachweis (${zeitraum})`, 14, 70);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Flüge: ${b.anzahl}`, 14, 77);
  doc.text(`Flugzeit: ${b.stunden} h ${b.restMin} min`, 60, 77);
  doc.text(`Aktive Tage: ${b.aktiveTage}`, 120, 77);
  doc.text(`Genutzte Drohnen: ${b.genutzteDrohnen}`, 14, 83);
  doc.text(`Vorfälle: ${b.vorfaelle}`, 60, 83);
  doc.text(`Flüge mit Auffälligkeiten: ${b.fluegeMitAuffaelligkeiten}`, 120, 83);

  autoTable(doc, {
    startY: 90,
    head: [['Datum', 'Drohne', 'Zeitraum', 'Dauer', 'Ort', 'Zweck', 'Bemerkungen']],
    body: pdfTabellenzeilen(fluege, drones),
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 6: { cellWidth: 50 } }, // Bemerkungen
  });

  doc.save(`skylog_de_logbuch_${jahr === 'alle' ? 'gesamt' : jahr}_${heute()}.pdf`);
}
