import type { Drone, Battery, UserProfile } from './db';
import { garantieStatus } from './maintenance';

export type ReminderLevel = 'warn' | 'alert';

export interface Reminder {
  level: ReminderLevel;
  text: string;
}

const DAY = 1000 * 60 * 60 * 24;

// Builds a list of actionable reminders from the pilot's data.
// Everything is derived from data already stored locally — no network needed.
export function getReminders(
  profile: UserProfile | null,
  drones: Drone[],
  batteries: Battery[],
  lastBackupAt: number | null = null,
  now: number = Date.now()
): Reminder[] {
  const reminders: Reminder[] = [];

  // 1) Fernpilotenzeugnis / Lizenz
  if (profile?.licenseExpiry) {
    const days = Math.ceil((new Date(profile.licenseExpiry).getTime() - now) / DAY);
    if (days < 0) {
      reminders.push({ level: 'alert', text: `Dein Fernpilotenzeugnis ist abgelaufen (seit ${Math.abs(days)} Tagen). Vor dem nächsten Flug erneuern!` });
    } else if (days <= 30) {
      reminders.push({ level: 'warn', text: `Dein Fernpilotenzeugnis läuft in ${days} Tagen ab. Rechtzeitig verlängern.` });
    }
  }

  // 2) Akku-Gesundheit & Zyklen
  for (const b of batteries) {
    const label = b.number ? `Akku ${b.number}` : 'Ein Akku';
    if (typeof b.health === 'number' && b.health > 0 && b.health < 60) {
      reminders.push({ level: 'alert', text: `${label} hat nur noch ${b.health}% Gesundheit — Austausch prüfen.` });
    } else if ((b.cycles ?? 0) >= 200) {
      reminders.push({ level: 'warn', text: `${label} hat ${b.cycles} Ladezyklen — im Auge behalten.` });
    }
  }

  // 3) Motor-/Wartungsreinigung überfällig (>90 Tage)
  for (const d of drones) {
    if (d.lastMotorClean) {
      const days = Math.floor((now - d.lastMotorClean) / DAY);
      if (days > 90) {
        reminders.push({ level: 'warn', text: `${d.name || d.model}: letzte Motorreinigung vor ${days} Tagen — Wartung fällig.` });
      }
    }
  }

  // 4) Versicherung fehlt
  if (profile && !profile.insuranceNumber) {
    reminders.push({ level: 'warn', text: 'Keine Versicherungsnummer hinterlegt. Für Drohnen in DE ist eine Haftpflicht Pflicht.' });
  }

  // 4b) Garantie läuft ab / ist abgelaufen
  for (const d of drones) {
    const g = garantieStatus(d, now);
    const label = d.name || d.model;
    if (g.status === 'bald') {
      reminders.push({ level: 'warn', text: `${label}: Garantie läuft in ${g.tage} Tagen ab — offene Reparaturen jetzt einreichen.` });
    } else if (g.status === 'abgelaufen') {
      // Nur innerhalb der ersten 30 Tage nach Ablauf melden, danach ist es alt.
      if (g.tage !== null && g.tage >= -30) {
        reminders.push({ level: 'warn', text: `${label}: Garantie ist abgelaufen (seit ${Math.abs(g.tage)} Tagen).` });
      }
    }
  }

  // 5) Datensicherung überfällig.
  // Alle Flugdaten liegen ausschließlich lokal im Browser — wird dessen
  // Speicher geleert, sind sie ersatzlos weg. Deshalb erinnern wir hier auch
  // dann, wenn noch nie gesichert wurde (aber nur, sobald Daten da sind).
  const hatDaten = drones.length > 0 || batteries.length > 0;
  if (hatDaten) {
    if (lastBackupAt === null) {
      reminders.push({
        level: 'warn',
        text: 'Noch nie gesichert. Deine Flugdaten liegen nur in diesem Browser — einmal exportieren.',
      });
    } else {
      const tage = Math.floor((now - lastBackupAt) / DAY);
      if (tage >= 90) {
        reminders.push({
          level: 'alert',
          text: `Letzte Sicherung vor ${tage} Tagen. Höchste Zeit für einen Export.`,
        });
      } else if (tage >= 30) {
        reminders.push({
          level: 'warn',
          text: `Letzte Sicherung vor ${tage} Tagen. Ein Export wäre wieder fällig.`,
        });
      }
    }
  }

  return reminders;
}
