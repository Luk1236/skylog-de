// Anpassbare Checklisten (Pre-/Post-Flight). Die Listenlogik ist rein und
// testbar; Laden/Speichern läuft dünn über localStorage. Bewusst kein
// IndexedDB-Store — es ist kleine Konfiguration, kein Datensatz.

export interface ChecklistPunkt {
  id: string;
  text: string;
}

export type ChecklistArt = 'preflight' | 'postflight';

export const DEFAULT_PREFLIGHT: string[] = [
  'Akkus voll geladen & Zustand geprüft',
  'Propeller fest & unbeschädigt',
  'Firmware & App aktuell',
  'Wetter im Limit (Wind, Sicht, kein Regen)',
  'Flugzone geprüft (dipul / NOTAM)',
  'e-ID an der Drohne angebracht',
  'Speicherkarte & Speicherplatz ok',
  'Umgebung frei von Menschen & Hindernissen',
];

export const DEFAULT_POSTFLIGHT: string[] = [
  'Drohne & Propeller auf Schäden geprüft',
  'Akkus entnommen, auf Lagerladung gebracht',
  'Aufnahmen gesichert / Speicherkarte geleert',
  'Auffälligkeiten im Logbuch notiert',
  'Gimbal-Sperre angebracht, Drohne verstaut',
];

function neueId(): string {
  return (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 8);
}

function ausTexten(texte: string[]): ChecklistPunkt[] {
  return texte.map(text => ({ id: neueId(), text }));
}

/** Standardpunkte der jeweiligen Art (frische IDs). */
export function standardPunkte(art: ChecklistArt): ChecklistPunkt[] {
  return ausTexten(art === 'preflight' ? DEFAULT_PREFLIGHT : DEFAULT_POSTFLIGHT);
}

// --- reine Listenoperationen (geben immer eine neue Liste zurück) ---

export function punktHinzufuegen(liste: ChecklistPunkt[], text: string): ChecklistPunkt[] {
  const sauber = text.trim();
  if (!sauber) return liste;
  return [...liste, { id: neueId(), text: sauber }];
}

export function punktEntfernen(liste: ChecklistPunkt[], id: string): ChecklistPunkt[] {
  return liste.filter(p => p.id !== id);
}

export function punktBearbeiten(liste: ChecklistPunkt[], id: string, text: string): ChecklistPunkt[] {
  const sauber = text.trim();
  return liste.map(p => (p.id === id ? { ...p, text: sauber || p.text } : p));
}

/** Verschiebt einen Punkt um eine Position (richtung -1 = hoch, +1 = runter). */
export function verschiebe(liste: ChecklistPunkt[], id: string, richtung: -1 | 1): ChecklistPunkt[] {
  const i = liste.findIndex(p => p.id === id);
  if (i === -1) return liste;
  const j = i + richtung;
  if (j < 0 || j >= liste.length) return liste;
  const kopie = [...liste];
  [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  return kopie;
}

// --- Persistenz ---

const KEY = (art: ChecklistArt) => `skylog_checklist_${art}`;

export function ladeChecklist(art: ChecklistArt): ChecklistPunkt[] {
  try {
    const roh = localStorage.getItem(KEY(art));
    if (!roh) return standardPunkte(art);
    const geparst = JSON.parse(roh);
    if (Array.isArray(geparst) && geparst.every(p => p && typeof p.id === 'string' && typeof p.text === 'string')) {
      return geparst;
    }
  } catch {
    // fällt auf Standard zurück
  }
  return standardPunkte(art);
}

export function speichereChecklist(art: ChecklistArt, punkte: ChecklistPunkt[]): void {
  localStorage.setItem(KEY(art), JSON.stringify(punkte));
}

export function setzeZurueck(art: ChecklistArt): ChecklistPunkt[] {
  const standard = standardPunkte(art);
  speichereChecklist(art, standard);
  return standard;
}
