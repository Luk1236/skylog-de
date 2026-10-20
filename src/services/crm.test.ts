import { beforeEach, describe, it, expect, vi } from 'vitest';
import { calculateCustomerStats, generateCustomerReportPdf } from './crm';
import type { Customer, Drone, Flight, UserProfile } from './db';

// jsPDF nachbauen: Texte, Seiten und Dateiname mitschreiben.
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
    text(t: string) { pdf.texte.push(t); }
    addPage() { pdf.seiten++; }
    save(name: string) { pdf.datei = name; }
  },
}));

const flug = (id: string, customerId: string | undefined, extra: Partial<Flight> = {}): Flight => ({
  id,
  droneId: 'd1',
  date: '2026-07-27',
  startTime: '10:00',
  endTime: '10:25',
  duration: 25,
  distanceKm: 3.5,
  location: 'Berlin',
  locationName: 'Berlin Hauptbahnhof',
  coordinates: [52.52, 13.40],
  notes: '',
  createdAt: 1000,
  customerId,
  ...extra,
});

const kunde: Customer = { id: 'cust1', name: 'Bau GmbH Nord', company: 'Bau GmbH', email: 'info@bau.example', createdAt: 1 };

describe('calculateCustomerStats', () => {
  it('zählt nur die Flüge des Kunden und summiert Dauer und Strecke', () => {
    const fluege = [
      flug('f1', 'cust1'),
      flug('f2', 'cust1', { duration: 35, distanceKm: 5.0 }),
      flug('f3', 'cust2', { duration: 15, distanceKm: 1.0 }),
      flug('f4', undefined),
    ];
    expect(calculateCustomerStats('cust1', fluege)).toEqual({ totalFlights: 2, totalDurationMinutes: 60, totalDistanceKm: 8.5 });
    expect(calculateCustomerStats('cust2', fluege)).toEqual({ totalFlights: 1, totalDurationMinutes: 15, totalDistanceKm: 1 });
  });

  it('wertet fehlende Dauer oder Strecke als 0', () => {
    const fluege = [flug('f1', 'cust1', { distanceKm: undefined }), flug('f2', 'cust1', { duration: undefined as unknown as number })];
    expect(calculateCustomerStats('cust1', fluege)).toEqual({ totalFlights: 2, totalDurationMinutes: 25, totalDistanceKm: 3.5 });
  });

  it('liefert Nullen für einen Kunden ohne Flüge', () => {
    expect(calculateCustomerStats('niemand', [flug('f1', 'cust1')])).toEqual({ totalFlights: 0, totalDurationMinutes: 0, totalDistanceKm: 0 });
  });
});

describe('generateCustomerReportPdf', () => {
  beforeEach(() => {
    pdf.texte = [];
    pdf.seiten = 1;
    pdf.datei = '';
  });

  const drohnen = [{ id: 'd1', model: 'DJI Mavic 3' }] as Drone[];
  const profil = { name: 'Erika Muster', eid: 'DEU-123', insuranceNumber: 'V-42' } as UserProfile;

  it('enthält Kunde, Pilot, Summen und jeden Einsatz des Kunden', async () => {
    const fluege = [
      flug('f1', 'cust1', { projectName: 'Dachinspektion', maxAltitude: 60 }),
      flug('f2', 'cust1', { duration: 35, distanceKm: 5, locationName: 'Lager Ost' }),
      flug('f3', 'cust2', { locationName: 'Fremder Ort' }),
    ];
    await generateCustomerReportPdf(kunde, fluege, drohnen, profil);
    const alles = pdf.texte.join('\n');
    expect(alles).toContain('Bau GmbH Nord');
    expect(alles).toContain('Firma: Bau GmbH');
    expect(alles).toContain('E-Mail: info@bau.example');
    expect(alles).not.toContain('Telefon:');
    expect(alles).toContain('Erika Muster');
    expect(alles).toContain('LBA e-ID: DEU-123');
    expect(alles).toContain('Versicherung: V-42');
    expect(alles).toContain('Gesamte Flüge: 2');
    expect(alles).toContain('Gesamtdauer: 1.0 Std. (60 Min.)');
    expect(alles).toContain('Strecke: 8.50 km');
    expect(alles).toContain('[Dachinspektion] Berlin Hauptbahnhof');
    expect(alles).toContain('Lager Ost');
    expect(alles).toContain('DJI Mavic 3');
    expect(alles).toContain('60 m');
    expect(alles).not.toContain('Fremder Ort');
    expect(pdf.datei).toBe('skylog_einsatzbericht_Bau_GmbH_Nord.pdf');
  });

  it('sagt es, wenn dem Kunden keine Flüge zugeordnet sind', async () => {
    await generateCustomerReportPdf(kunde, [flug('f1', 'cust2')], drohnen, null);
    const alles = pdf.texte.join('\n');
    expect(alles).toContain('Keine Flüge für diesen Kunden zugeordnet.');
    expect(alles).toContain('Fernpilot');
  });

  it('bricht lange Einsatzlisten auf weitere Seiten um', async () => {
    const viele = Array.from({ length: 40 }, (_, i) => flug(`f${i}`, 'cust1', { droneId: 'unbekannt' }));
    await generateCustomerReportPdf(kunde, viele, drohnen, profil);
    expect(pdf.seiten).toBeGreaterThan(1);
    expect(pdf.texte.filter(t => t === 'Unbekannt')).toHaveLength(40);
  });
});
