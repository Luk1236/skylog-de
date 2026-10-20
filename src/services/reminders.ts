import type { Drone, Battery, UserProfile } from './db';
import { garantieStatus } from './maintenance';

export type ReminderLevel = 'warn' | 'alert';

export interface Reminder {
  level: ReminderLevel;
  text: string;
  /** Englische Fassung - die Oberfläche wählt nach Sprache. */
  textEn: string;
  /** Stabiler Schlüssel (ändert sich nicht mit Zahlen im Text) - zum Ausblenden. */
  schluessel: string;
}

const DAY = 1000 * 60 * 60 * 24;

// Builds a list of actionable reminders from the pilot's data.
// Everything is derived from data already stored locally — no network needed.
export function getReminders(
  profile: UserProfile | null,
  drones: Drone[],
  batteries: Battery[],
  lastBackupAt: number | null = null,
  now: number = Date.now(),
  /** Nach so vielen Tagen ist eine Sicherung faellig (Einstellung im Datensicherungs-Dialog). */
  sicherungsIntervallTage = 30,
): Reminder[] {
  const reminders: Reminder[] = [];

  // 1) Fernpilotenzeugnis / Lizenz
  if (profile?.licenseExpiry) {
    const days = Math.ceil((new Date(profile.licenseExpiry).getTime() - now) / DAY);
    if (days < 0) {
      reminders.push({
        level: 'alert', schluessel: 'lizenz',
        text: `Dein Fernpilotenzeugnis ist abgelaufen (seit ${Math.abs(days)} Tagen). Vor dem nächsten Flug erneuern!`,
        textEn: `Your remote pilot certificate has expired (${Math.abs(days)} days ago). Renew it before your next flight!`,
      });
    } else if (days <= 30) {
      reminders.push({
        level: 'warn', schluessel: 'lizenz',
        text: `Dein Fernpilotenzeugnis läuft in ${days} Tagen ab. Rechtzeitig verlängern.`,
        textEn: `Your remote pilot certificate expires in ${days} days. Renew it in time.`,
      });
    }
  }

  // 2) Akku-Gesundheit & Zyklen
  for (const b of batteries) {
    const label = b.number ? `Akku ${b.number}` : 'Ein Akku';
    const labelEn = b.number ? `Battery ${b.number}` : 'A battery';
    if (typeof b.health === 'number' && b.health > 0 && b.health < 60) {
      reminders.push({
        level: 'alert', schluessel: `akku-gesundheit-${b.id}`,
        text: `${label} hat nur noch ${b.health}% Gesundheit — Austausch prüfen.`,
        textEn: `${labelEn} is down to ${b.health}% health — consider replacing it.`,
      });
    } else if ((b.cycles ?? 0) >= 200) {
      reminders.push({
        level: 'warn', schluessel: `akku-zyklen-${b.id}`,
        text: `${label} hat ${b.cycles} Ladezyklen — im Auge behalten.`,
        textEn: `${labelEn} has ${b.cycles} charge cycles — keep an eye on it.`,
      });
    }
  }

  // 3) Motor-/Wartungsreinigung überfällig (>90 Tage)
  for (const d of drones) {
    if (d.lastMotorClean) {
      const days = Math.floor((now - d.lastMotorClean) / DAY);
      if (days > 90) {
        reminders.push({
          level: 'warn', schluessel: `motor-${d.id}`,
          text: `${d.name || d.model}: letzte Motorreinigung vor ${days} Tagen — Wartung fällig.`,
          textEn: `${d.name || d.model}: last motor cleaning ${days} days ago — maintenance due.`,
        });
      }
    }
  }

  // 4) Versicherung fehlt
  if (profile && !profile.insuranceNumber) {
    reminders.push({
      level: 'warn', schluessel: 'versicherung',
      text: 'Keine Versicherungsnummer hinterlegt. Für Drohnen in DE ist eine Haftpflicht Pflicht.',
      textEn: 'No insurance number stored. Liability insurance is mandatory for drones in Germany.',
    });
  }

  // 4b) Garantie läuft ab / ist abgelaufen
  for (const d of drones) {
    const g = garantieStatus(d, now);
    const label = d.name || d.model;
    if (g.status === 'bald') {
      reminders.push({
        level: 'warn', schluessel: `garantie-${d.id}`,
        text: `${label}: Garantie läuft in ${g.tage} Tagen ab — offene Reparaturen jetzt einreichen.`,
        textEn: `${label}: warranty expires in ${g.tage} days — submit open repairs now.`,
      });
    } else if (g.status === 'abgelaufen') {
      // Nur innerhalb der ersten 30 Tage nach Ablauf melden, danach ist es alt.
      if (g.tage !== null && g.tage >= -30) {
        reminders.push({
          level: 'warn', schluessel: `garantie-${d.id}`,
          text: `${label}: Garantie ist abgelaufen (seit ${Math.abs(g.tage)} Tagen).`,
          textEn: `${label}: warranty expired (${Math.abs(g.tage)} days ago).`,
        });
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
        schluessel: 'sicherung',
        text: 'Noch nie gesichert. Deine Flugdaten liegen nur in diesem Browser — einmal exportieren.',
        textEn: 'Never backed up. Your flight data only lives in this browser — export it once.',
      });
    } else {
      const tage = Math.floor((now - lastBackupAt) / DAY);
      if (tage >= Math.max(90, sicherungsIntervallTage * 3)) {
        reminders.push({
          level: 'alert',
          schluessel: 'sicherung',
          text: `Letzte Sicherung vor ${tage} Tagen. Höchste Zeit für einen Export.`,
          textEn: `Last backup ${tage} days ago. High time for an export.`,
        });
      } else if (tage >= sicherungsIntervallTage) {
        reminders.push({
          level: 'warn',
          schluessel: 'sicherung',
          text: `Letzte Sicherung vor ${tage} Tagen. Ein Export wäre wieder fällig.`,
          textEn: `Last backup ${tage} days ago. An export is due again.`,
        });
      }
    }
  }

  return reminders;
}
