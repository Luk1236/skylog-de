// Dauerhafter Speicher: Ohne navigator.storage.persist() darf der Browser die
// IndexedDB bei Speichermangel räumen - mit allen Flügen. Installierte Web-Apps
// bekommen die Freigabe in Chrome meist ohne Rückfrage; sonst gibt es den Knopf
// in den Einstellungen. Die Android-App speichert ohnehin im App-Speicher.

export interface SpeicherStatus {
  /** null: Der Browser kann es nicht sagen (keine Storage-API). */
  dauerhaft: boolean | null;
  /** Belegter Speicher in Bytes (Schätzung des Browsers). */
  belegt?: number;
  /** Speicher, den der Browser der App höchstens zugesteht, in Bytes. */
  gesamt?: number;
}

export async function leseSpeicherStatus(): Promise<SpeicherStatus> {
  const speicher = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!speicher?.persisted) return { dauerhaft: null };
  try {
    const [dauerhaft, schaetzung] = await Promise.all([
      speicher.persisted(),
      speicher.estimate ? speicher.estimate() : Promise.resolve(undefined),
    ]);
    return { dauerhaft, belegt: schaetzung?.usage, gesamt: schaetzung?.quota };
  } catch {
    return { dauerhaft: null };
  }
}

/** Bittet den Browser um dauerhaften Speicher. true = gewährt. */
export async function dauerhaftAnfordern(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Bytes lesbar, z. B. „1,5 MB“. */
export function formatiereBytes(bytes: number, sprache: 'de' | 'en'): string {
  const einheiten = ['B', 'KB', 'MB', 'GB', 'TB'];
  let wert = Math.max(0, bytes);
  let i = 0;
  while (wert >= 1024 && i < einheiten.length - 1) {
    wert /= 1024;
    i++;
  }
  const stellen = i > 0 && wert < 10 ? 1 : 0;
  const zahl = new Intl.NumberFormat(sprache === 'en' ? 'en-GB' : 'de-DE', { maximumFractionDigits: stellen }).format(wert);
  return `${zahl} ${einheiten[i]}`;
}
