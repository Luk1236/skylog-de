import type { Flight, MaintenanceRecord } from '../../services/db';

/** Kennzahlen einer Drohne für die Wartungshinweise. */
export interface DrohnenStatistik {
  /** Flugstunden gesamt. */
  hours: number;
  flights: number;
  /** Letzte Wartung je Typ (Zeitstempel) und die Flugstunden zu dem Zeitpunkt. */
  lastMaint: Record<string, number>;
  lastMaintHours: Record<string, number>;
  /** Flüge seit der letzten Wartung je Typ. */
  flightsSinceMaint: Record<string, number>;
}

export interface WartungsHinweis {
  /** Wartungstyp wie in MaintenanceRecord ('Firmware', 'Propeller', 'Motor', 'Sensor', 'General'). */
  type: string;
  reason: string;
  detail: string;
}

const TAG = 24 * 60 * 60 * 1000;

/** Statistik aus den Flügen und Wartungen einer Drohne. */
export function drohnenStatistik(fluege: Flight[], wartungen: MaintenanceRecord[]): DrohnenStatistik {
  const lastMaint: Record<string, number> = {};
  const lastMaintHours: Record<string, number> = {};
  for (const m of wartungen) {
    if (!lastMaint[m.type] || m.createdAt > lastMaint[m.type]) {
      lastMaint[m.type] = m.createdAt;
      lastMaintHours[m.type] = m.hoursAtMaintenance || 0;
    }
  }
  const flightsSinceMaint: Record<string, number> = {};
  for (const typ of Object.keys(lastMaint)) {
    flightsSinceMaint[typ] = fluege.filter(f => f.createdAt > lastMaint[typ]).length;
  }
  return {
    hours: fluege.reduce((summe, f) => summe + (f.duration / 60), 0),
    flights: fluege.length,
    lastMaint,
    lastMaintHours,
    flightsSinceMaint,
  };
}

/** Empfohlene Wartungen nach Zeit, Flugstunden und Flügen seit der letzten Wartung. */
export function wartungsHinweise(
  stats: DrohnenStatistik | undefined,
  tx: (de: string, en: string) => string,
  jetzt: number = Date.now(),
): WartungsHinweis[] {
  if (!stats) return [];
  const hinweise: WartungsHinweis[] = [];

  // Firmware: alle 90 Tage
  if (!stats.lastMaint['Firmware'] || (jetzt - stats.lastMaint['Firmware']) > 90 * TAG) {
    hinweise.push({ type: 'Firmware', reason: tx('Update fällig', 'Update due'), detail: tx('Firmware-Update seit über 90 Tagen nicht durchgeführt.', 'No firmware update for more than 90 days.') });
  }

  // Propeller: nach 10 Flugstunden oder 50 Flügen seit dem letzten Check
  const propFluege = stats.flightsSinceMaint?.['Propeller'] ?? stats.flights;
  if (stats.hours > 10 && (!stats.lastMaint['Propeller'] || (stats.hours - (stats.lastMaintHours['Propeller'] || 0)) > 10)) {
    hinweise.push({ type: 'Propeller', reason: tx('Sichtprüfung (10h)', 'Visual check (10 h)'), detail: tx('Propeller auf Haarrisse und Abnutzung prüfen.', 'Check propellers for hairline cracks and wear.') });
  } else if (propFluege >= 50) {
    hinweise.push({ type: 'Propeller', reason: tx(`${propFluege} Flüge seit letztem Check`, `${propFluege} flights since last check`), detail: tx('Empfehlung: Propeller nach 50 Flügen sorgfältig prüfen oder tauschen.', 'Recommendation: inspect or replace propellers carefully after 50 flights.') });
  }

  // Motoren: nach 25 Flugstunden oder 100 Flügen
  const motorFluege = stats.flightsSinceMaint?.['Motor'] ?? stats.flights;
  if (stats.hours > 25 && (!stats.lastMaint['Motor'] || (stats.hours - (stats.lastMaintHours['Motor'] || 0)) > 25)) {
    hinweise.push({ type: 'Motor', reason: tx('Motorreinigung (25h)', 'Motor cleaning (25 h)'), detail: tx('Motoren auf Fremdkörper prüfen und mit Druckluft reinigen.', 'Check motors for debris and clean them with compressed air.') });
  } else if (motorFluege >= 100) {
    hinweise.push({ type: 'Motor', reason: tx(`${motorFluege} Flüge seit letzter Reinigung`, `${motorFluege} flights since last cleaning`), detail: tx('Empfehlung: Motoren nach 100 Flügen reinigen und auf Lager prüfen.', 'Recommendation: clean motors and check bearings after 100 flights.') });
  }

  // Sensoren: alle 6 Monate kalibrieren
  if (!stats.lastMaint['Sensor'] || (jetzt - stats.lastMaint['Sensor']) > 180 * TAG) {
    hinweise.push({ type: 'Sensor', reason: tx('Sensor-Kalibrierung', 'Sensor calibration'), detail: tx('IMU und Kompass-Kalibrierung für optimale Stabilität empfohlen.', 'IMU and compass calibration recommended for best stability.') });
  }

  // Jahresservice
  if (!stats.lastMaint['General'] || (jetzt - stats.lastMaint['General']) > 365 * TAG) {
    hinweise.push({ type: 'General', reason: tx('Jahresservice', 'Annual service'), detail: tx('Vollständiger Systemcheck nach einem Jahr Betrieb empfohlen.', 'Full system check recommended after one year of operation.') });
  }

  return hinweise;
}
