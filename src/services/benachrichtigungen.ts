// Echte Android-Benachrichtigungen für Fristen - ganz ohne Server.
//
// Die Erinnerungen in der App (reminders.ts) sieht man nur, wenn man die App
// öffnet. Für Fristen ist das zu spät. Deshalb plant die Android-App lokale
// Benachrichtigungen auf den passenden Tag (Capacitor Local Notifications):
// Ablauf des Fernpilotenzeugnisses, Ende der Garantie, fällige Wartung und
// fällige Datensicherung. Bei jeder Datenänderung wird neu geplant.
//
// planeBenachrichtigungen ist reine Berechnung (testbar); synchronisiere…
// spricht mit dem Plugin und tut im Browser nichts.

import { Capacitor } from '@capacitor/core';
import type { Battery, Drone, UserProfile } from './db';

const TAG = 24 * 60 * 60 * 1000;
const MAX_ANZAHL = 20;

export interface GeplanteBenachrichtigung {
  id: number;
  titel: string;
  text: string;
  zeitpunkt: number;
}

/** Stabile, positive 31-Bit-ID aus einem Schlüssel - gleiche Frist, gleiche ID. */
export function idFuer(schluessel: string): number {
  let h = 0;
  for (let i = 0; i < schluessel.length; i++) h = (Math.imul(h, 31) + schluessel.charCodeAt(i)) | 0;
  return (h & 0x7fffffff) || 1;
}

/** Tag von `basis` um `stunde` Uhr Ortszeit. */
function amTag(basis: number, stunde: number): number {
  const d = new Date(basis);
  d.setHours(stunde, 0, 0, 0);
  return d.getTime();
}

export function planeBenachrichtigungen(
  profile: UserProfile | null,
  drones: Drone[],
  batteries: Battery[],
  lastBackupAt: number | null,
  sicherungsIntervallTage: number,
  now = Date.now(),
): GeplanteBenachrichtigung[] {
  const liste: GeplanteBenachrichtigung[] = [];
  const add = (schluessel: string, titel: string, text: string, zeitpunkt: number) => {
    if (zeitpunkt > now) liste.push({ id: idFuer(schluessel), titel, text, zeitpunkt });
  };

  // Fernpilotenzeugnis: 30 und 7 Tage vorher sowie am Ablauftag
  if (profile?.licenseExpiry) {
    const ablauf = new Date(profile.licenseExpiry).getTime();
    if (Number.isFinite(ablauf)) {
      add('lizenz-30', 'Fernpilotenzeugnis läuft ab', 'Dein Fernpilotenzeugnis läuft in 30 Tagen ab. Rechtzeitig verlängern.', amTag(ablauf - 30 * TAG, 9));
      add('lizenz-7', 'Fernpilotenzeugnis läuft ab', 'Dein Fernpilotenzeugnis läuft in 7 Tagen ab.', amTag(ablauf - 7 * TAG, 9));
      add('lizenz-0', 'Fernpilotenzeugnis abgelaufen', 'Dein Fernpilotenzeugnis ist heute abgelaufen. Vor dem nächsten Flug erneuern!', amTag(ablauf, 9));
    }
  }

  for (const d of drones) {
    const name = d.name || d.model;
    // Garantie: 14 Tage vorher - Zeit, offene Reparaturen einzureichen
    if (d.warrantyUntil) {
      const ende = new Date(d.warrantyUntil).getTime();
      if (Number.isFinite(ende)) {
        add(`garantie-${d.id}`, 'Garantie endet bald', `${name}: Garantie endet in 14 Tagen – offene Reparaturen jetzt einreichen.`, amTag(ende - 14 * TAG, 9));
      }
    }
    // Wartung: eigenes Intervall oder 90 Tage nach der letzten Motorreinigung
    if (d.lastMotorClean) {
      const tage = d.maintenanceIntervalDays ?? 90;
      add(`wartung-${d.id}`, 'Wartung fällig', `${name}: Letzte Wartung vor ${tage} Tagen – Motoren und Propeller prüfen.`, amTag(d.lastMotorClean + tage * TAG, 9));
    }
  }

  // Datensicherung: fällig nach dem eingestellten Intervall; ist sie schon
  // überfällig (oder gab es nie eine), am nächsten Abend erinnern.
  const hatDaten = drones.length > 0 || batteries.length > 0;
  if (hatDaten) {
    const faellig = lastBackupAt === null ? now : lastBackupAt + sicherungsIntervallTage * TAG;
    const zeitpunkt = faellig > now ? amTag(faellig, 18) : amTag(now + TAG, 18);
    add('sicherung', 'Datensicherung fällig', 'Deine Flugdaten liegen nur auf diesem Handy. Jetzt in SkyLog eine Sicherung exportieren.', zeitpunkt);
  }

  return liste.sort((a, b) => a.zeitpunkt - b.zeitpunkt).slice(0, MAX_ANZAHL);
}

/** Plant die Benachrichtigungen auf Android neu. Im Browser: nichts. */
export async function synchronisiereBenachrichtigungen(geplant: GeplanteBenachrichtigung[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const offen = await LocalNotifications.getPending();
    if (offen.notifications.length) await LocalNotifications.cancel({ notifications: offen.notifications.map(n => ({ id: n.id })) });
    if (geplant.length === 0) return;

    let erlaubt = (await LocalNotifications.checkPermissions()).display;
    if (erlaubt === 'prompt' || erlaubt === 'prompt-with-rationale') {
      erlaubt = (await LocalNotifications.requestPermissions()).display;
    }
    if (erlaubt !== 'granted') return;

    await LocalNotifications.schedule({
      notifications: geplant.map(g => ({
        id: g.id,
        title: g.titel,
        body: g.text,
        schedule: { at: new Date(g.zeitpunkt), allowWhileIdle: true },
      })),
    });
  } catch (err) {
    // Benachrichtigungen sind ein Komfort - ein Fehler darf die App nicht stören.
    console.warn('Benachrichtigungen konnten nicht geplant werden:', err);
  }
}
