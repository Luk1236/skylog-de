// Bilder an Flüge hängen. Die Bilder liegen als Data-URL direkt am Flug,
// damit sie ohne Zusatzverknüpfung in der Sicherung landen. Das kostet Platz,
// deshalb gibt es harte Grenzen pro Bild und pro Flug — die Prüfung ist rein
// und testbar, das eigentliche Einlesen der Datei passiert in der Komponente.

import type { FlightMedia } from './db';

/** Größte erlaubte Einzeldatei (Bytes). Data-URLs blähen ~33 % auf. */
export const MAX_BILD_BYTES = 3 * 1024 * 1024;   // 3 MB
/** Obergrenze für alle Bilder eines Fluges zusammen. */
export const MAX_FLUG_BYTES = 12 * 1024 * 1024;  // 12 MB

export function istBild(type: string): boolean {
  return typeof type === 'string' && type.startsWith('image/');
}

export function formatGroesse(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`.replace('.', ',');
}

export function gesamtGroesse(media: FlightMedia[] = []): number {
  return media.reduce((s, m) => s + (m.size || 0), 0);
}

export interface PruefErgebnis {
  ok: boolean;
  fehler?: string;
}

/** Prüft eine neue Datei gegen Typ und die Größengrenzen. */
export function pruefeDatei(
  datei: { name: string; type: string; size: number },
  vorhanden: FlightMedia[] = []
): PruefErgebnis {
  if (!istBild(datei.type)) {
    return { ok: false, fehler: 'Nur Bilder werden unterstützt (JPG, PNG, HEIC …).' };
  }
  if (datei.size > MAX_BILD_BYTES) {
    return { ok: false, fehler: `Bild ist ${formatGroesse(datei.size)} groß — Grenze sind ${formatGroesse(MAX_BILD_BYTES)}.` };
  }
  if (gesamtGroesse(vorhanden) + datei.size > MAX_FLUG_BYTES) {
    return { ok: false, fehler: `Der Flug hätte damit über ${formatGroesse(MAX_FLUG_BYTES)} an Bildern. Erst welche entfernen.` };
  }
  return { ok: true };
}

export function mediaHinzufuegen(liste: FlightMedia[] = [], neu: FlightMedia): FlightMedia[] {
  return [...liste, neu];
}

export function mediaEntfernen(liste: FlightMedia[] = [], id: string): FlightMedia[] {
  return liste.filter(m => m.id !== id);
}
