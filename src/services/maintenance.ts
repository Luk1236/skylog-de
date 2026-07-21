// Wartungs- und Garantie-Logik. Reine Berechnung aus Drohnen-, Flug- und
// Wartungsdaten — kein Netz, keine Seiteneffekte.

import type { Drone, Flight, MaintenanceRecord } from './db';

const DAY = 1000 * 60 * 60 * 24;

/** Gesamte Flugzeit einer Drohne in Stunden. */
export function flugStundenGesamt(flights: Flight[], droneId: string): number {
  const minuten = flights
    .filter(f => f.droneId === droneId)
    .reduce((s, f) => s + (f.duration || 0), 0);
  return Math.round((minuten / 60) * 10) / 10;
}

/** Jüngster Wartungseintrag einer Drohne (nach Datum). */
export function letzteWartung(records: MaintenanceRecord[], droneId: string): MaintenanceRecord | null {
  const eigene = records
    .filter(r => r.droneId === droneId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return eigene[0] ?? null;
}

/** Summe aller Wartungskosten einer Drohne. */
export function gesamtKosten(records: MaintenanceRecord[], droneId: string): number {
  return records
    .filter(r => r.droneId === droneId)
    .reduce((s, r) => s + (r.cost || 0), 0);
}

export type GarantieStatus = 'keine' | 'aktiv' | 'bald' | 'abgelaufen';

export interface GarantieInfo {
  status: GarantieStatus;
  tage: number | null; // Tage bis Ablauf (negativ = abgelaufen)
}

// „bald" ab 30 Tagen Restlaufzeit — dann lohnt sich, offene Reparaturen
// noch einzureichen.
export function garantieStatus(drone: Drone, now: number = Date.now()): GarantieInfo {
  if (!drone.warrantyUntil) return { status: 'keine', tage: null };
  const ende = new Date(drone.warrantyUntil).getTime();
  if (!Number.isFinite(ende)) return { status: 'keine', tage: null };
  const tage = Math.ceil((ende - now) / DAY);
  if (tage < 0) return { status: 'abgelaufen', tage };
  if (tage <= 30) return { status: 'bald', tage };
  return { status: 'aktiv', tage };
}

export interface WartungInfo {
  level: 'ok' | 'warn' | 'alert';
  gruende: string[];
  tageSeitLetzter: number | null;
  stundenSeitLetzter: number | null;
}

// Wartung ist fällig, wenn das Kalender- ODER das Stundenintervall überschritten
// ist. „warn" schon kurz vorher (7 Tage bzw. 90 % der Stunden), damit man
// vorausplanen kann. Ohne konfiguriertes Intervall gibt es kein Urteil.
export function wartungStatus(
  drone: Drone,
  flights: Flight[],
  records: MaintenanceRecord[],
  now: number = Date.now()
): WartungInfo {
  const gruende: string[] = [];
  let level: WartungInfo['level'] = 'ok';
  const anheben = (l: WartungInfo['level']) => {
    if (l === 'alert' || (l === 'warn' && level === 'ok')) level = l;
  };

  const letzte = letzteWartung(records, drone.id);
  // Basis-Datum: letzte Wartung, sonst Kauf, sonst Anlage der Drohne.
  const basisDatum = letzte?.date
    ? new Date(letzte.date).getTime()
    : drone.purchaseDate
      ? new Date(drone.purchaseDate).getTime()
      : drone.createdAt;

  const tageSeitLetzter = Number.isFinite(basisDatum)
    ? Math.floor((now - basisDatum) / DAY)
    : null;

  // Kalenderintervall
  if (drone.maintenanceIntervalDays && tageSeitLetzter !== null) {
    const grenze = drone.maintenanceIntervalDays;
    if (tageSeitLetzter >= grenze) {
      gruende.push(`Kalender-Wartung überfällig (${tageSeitLetzter} von ${grenze} Tagen).`);
      anheben('alert');
    } else if (tageSeitLetzter >= grenze - 7) {
      gruende.push(`Kalender-Wartung bald fällig (${tageSeitLetzter} von ${grenze} Tagen).`);
      anheben('warn');
    }
  }

  // Stundenintervall
  let stundenSeitLetzter: number | null = null;
  if (drone.maintenanceIntervalHours) {
    const gesamt = flugStundenGesamt(flights, drone.id);
    const beiLetzter = letzte?.hoursAtMaintenance ?? 0;
    stundenSeitLetzter = Math.round((gesamt - beiLetzter) * 10) / 10;
    const grenze = drone.maintenanceIntervalHours;
    if (stundenSeitLetzter >= grenze) {
      gruende.push(`Stunden-Wartung überfällig (${stundenSeitLetzter} von ${grenze} h).`);
      anheben('alert');
    } else if (stundenSeitLetzter >= grenze * 0.9) {
      gruende.push(`Stunden-Wartung bald fällig (${stundenSeitLetzter} von ${grenze} h).`);
      anheben('warn');
    }
  }

  return { level, gruende, tageSeitLetzter, stundenSeitLetzter };
}
