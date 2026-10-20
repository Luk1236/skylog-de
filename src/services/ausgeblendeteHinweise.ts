// Erinnerungen im Logbuch für eine Weile ausblenden („in 7 Tagen erinnern“).
// Gespeichert wird je Hinweis-Schlüssel der Zeitpunkt, bis zu dem er ruht.
// Nur eine Bequemlichkeit: Ist localStorage gesperrt, erscheinen alle Hinweise.

const SPEICHER = 'skylog_ausgeblendete_hinweise';
const TAG = 24 * 60 * 60 * 1000;

type Ruhezeiten = Record<string, number>;

function lese(): Ruhezeiten {
  try {
    const roh = JSON.parse(localStorage.getItem(SPEICHER) || '{}');
    return roh && typeof roh === 'object' ? roh as Ruhezeiten : {};
  } catch {
    return {};
  }
}

function schreibe(z: Ruhezeiten): void {
  try { localStorage.setItem(SPEICHER, JSON.stringify(z)); } catch { /* egal */ }
}

/** Blendet einen Hinweis für `tage` Tage aus. Abgelaufene Einträge räumt es mit auf. */
export function blendeAus(schluessel: string, tage = 7, now = Date.now()): void {
  const z = lese();
  for (const [k, bis] of Object.entries(z)) if (bis <= now) delete z[k];
  z[schluessel] = now + tage * TAG;
  schreibe(z);
}

/** Nur die Hinweise, die gerade nicht ausgeblendet sind. */
export function sichtbareHinweise<T extends { schluessel: string }>(liste: T[], now = Date.now()): T[] {
  const z = lese();
  return liste.filter(h => !(z[h.schluessel] > now));
}
