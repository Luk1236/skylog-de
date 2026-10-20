// Anpassbare Checklisten (Pre-/Post-Flight). Die Listenlogik ist rein und
// testbar; Laden/Speichern läuft dünn über localStorage. Bewusst kein
// IndexedDB-Store — es ist kleine Konfiguration, kein Datensatz.

export interface ChecklistPunkt {
  id: string;
  text: string;
}

export type ChecklistArt = 'preflight' | 'postflight';

// Die Vorflug-Liste ist im Flug-Assistenten Pflicht vor dem Start. Sie enthält
// auch die wichtigen Punkte der früheren fest eingebauten Liste (Fernsteuerung,
// Gimbal-Schutz, Homepoint/Höhenlimit).
export const DEFAULT_PREFLIGHT: string[] = [
  'Akkus voll geladen & Zustand geprüft',
  'Fernsteuerung & Smartphone geladen',
  'Propeller fest & unbeschädigt',
  'Gimbal-Schutz entfernt',
  'Firmware & App aktuell',
  'Wetter im Limit (Wind, Sicht, kein Regen)',
  'Flugzone geprüft (dipul / NOTAM)',
  'e-ID an der Drohne angebracht',
  'Speicherkarte & Speicherplatz ok',
  'Umgebung frei von Menschen & Hindernissen',
  'Homepoint gesetzt & Höhenlimit max. 120 m',
];

export const DEFAULT_POSTFLIGHT: string[] = [
  'Drohne & Propeller auf Schäden geprüft',
  'Akkus entnommen, auf Lagerladung gebracht',
  'Aufnahmen gesichert / Speicherkarte geleert',
  'Auffälligkeiten im Logbuch notiert',
  'Gimbal-Sperre angebracht, Drohne verstaut',
];

// Englische Fassung der Standardpunkte. Gespeichert wird der deutsche Text;
// solange ein Punkt unverändert ist, zeigt die englische Oberfläche diese Übersetzung.
const STANDARD_EN: Record<string, string> = {
  'Akkus voll geladen & Zustand geprüft': 'Batteries fully charged & condition checked',
  'Fernsteuerung & Smartphone geladen': 'Remote controller & smartphone charged',
  'Propeller fest & unbeschädigt': 'Propellers secure & undamaged',
  'Gimbal-Schutz entfernt': 'Gimbal guard removed',
  'Firmware & App aktuell': 'Firmware & app up to date',
  'Wetter im Limit (Wind, Sicht, kein Regen)': 'Weather within limits (wind, visibility, no rain)',
  'Flugzone geprüft (dipul / NOTAM)': 'Flight zone checked (dipul / NOTAM)',
  'e-ID an der Drohne angebracht': 'e-ID attached to the drone',
  'Speicherkarte & Speicherplatz ok': 'Memory card & storage OK',
  'Umgebung frei von Menschen & Hindernissen': 'Surroundings clear of people & obstacles',
  'Homepoint gesetzt & Höhenlimit max. 120 m': 'Home point set & altitude limit max. 120 m',
  'Drohne & Propeller auf Schäden geprüft': 'Drone & propellers checked for damage',
  'Akkus entnommen, auf Lagerladung gebracht': 'Batteries removed and set to storage charge',
  'Aufnahmen gesichert / Speicherkarte geleert': 'Footage backed up / memory card cleared',
  'Auffälligkeiten im Logbuch notiert': 'Anomalies noted in the logbook',
  'Gimbal-Sperre angebracht, Drohne verstaut': 'Gimbal lock fitted, drone packed away',
};

/** Anzeigetext eines Punkts: Standardpunkte erscheinen auf Englisch übersetzt,
 *  eigene Punkte so, wie der Nutzer sie geschrieben hat. */
export function punktText(punkt: ChecklistPunkt, sprache: 'de' | 'en'): string {
  return sprache === 'en' ? STANDARD_EN[punkt.text] ?? punkt.text : punkt.text;
}

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
