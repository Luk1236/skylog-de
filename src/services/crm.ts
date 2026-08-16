import type { Customer, Flight, UserProfile, Drone } from './db';

export interface CustomerStats {
  totalFlights: number;
  totalDurationMinutes: number;
  totalDistanceKm: number;
}

export function calculateCustomerStats(customerId: string, flights: Flight[]): CustomerStats {
  const customerFlights = flights.filter(f => f.customerId === customerId);
  const totalFlights = customerFlights.length;
  const totalDurationMinutes = customerFlights.reduce((sum, f) => sum + (f.duration || 0), 0);
  const totalDistanceKm = customerFlights.reduce((sum, f) => sum + (f.distanceKm || 0), 0);

  return {
    totalFlights,
    totalDurationMinutes,
    totalDistanceKm,
  };
}

export async function generateCustomerReportPdf(
  customer: Customer,
  flights: Flight[],
  drones: Drone[],
  profile: UserProfile | null
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const customerFlights = flights.filter(f => f.customerId === customer.id);
  const stats = calculateCustomerStats(customer.id, flights);

  // Header Banner
  doc.setFillColor(30, 58, 138); // brand-blue
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SkyLog DE — Einsatzbericht & Flugnachweis', 15, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 15, 27);

  // Customer Info Box
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Auftraggeber / Kunde:', 15, 48);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(customer.name, 15, 56);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  if (customer.company) doc.text(`Firma: ${customer.company}`, 15, 62);
  if (customer.email) doc.text(`E-Mail: ${customer.email}`, 15, 67);
  if (customer.phone) doc.text(`Telefon: ${customer.phone}`, 15, 72);
  if (customer.address) doc.text(`Adresse: ${customer.address}`, 15, 77);

  // Pilot Info
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Ausführendes Unternehmen / Pilot:', 120, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(profile?.name || 'Fernpilot', 120, 55);
  if (profile?.eid) doc.text(`LBA e-ID: ${profile.eid}`, 120, 61);
  if (profile?.insuranceNumber) doc.text(`Versicherung: ${profile.insuranceNumber}`, 120, 67);

  // Summary Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 85, 180, 20, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Gesamte Flüge: ${stats.totalFlights}`, 25, 97);
  doc.text(`Gesamtdauer: ${(stats.totalDurationMinutes / 60).toFixed(1)} Std. (${stats.totalDurationMinutes} Min.)`, 85, 97);
  doc.text(`Strecke: ${stats.totalDistanceKm.toFixed(2)} km`, 150, 97);

  // Flight List
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Aufgezeichnete Einsätze:', 15, 118);

  let y = 126;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(226, 232, 240);
  doc.rect(15, y, 180, 7, 'F');
  doc.text('Datum / Zeit', 18, y + 5);
  doc.text('Ort / Projekt', 55, y + 5);
  doc.text('Drohne', 110, y + 5);
  doc.text('Dauer', 155, y + 5);
  doc.text('Höhe', 180, y + 5);

  y += 10;
  doc.setFont('helvetica', 'normal');

  if (customerFlights.length === 0) {
    doc.text('Keine Flüge für diesen Kunden zugeordnet.', 18, y);
  } else {
    customerFlights.forEach((f) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const drone = drones.find(d => d.id === f.droneId);
      doc.text(`${f.date} ${f.startTime || ''}`, 18, y);
      doc.text((f.projectName ? `[${f.projectName}] ` : '') + (f.locationName || 'Unbekannt'), 55, y);
      doc.text(drone?.model || 'Unbekannt', 110, y);
      doc.text(`${f.duration} min`, 155, y);
      doc.text(`${f.maxAltitude || 0} m`, 180, y);
      y += 7;
    });
  }

  // Signature Block
  y = Math.max(y + 20, 245);
  if (y > 265) {
    doc.addPage();
    y = 240;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(15, y, 85, y);
  doc.line(115, y, 185, y);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Unterschrift Fernpilot / Betreiber', 15, y + 4);
  doc.text('Unterschrift Kunde / Auftragsbestätigung', 115, y + 4);

  doc.save(`skylog_einsatzbericht_${customer.name.replace(/\s+/g, '_')}.pdf`);
}
