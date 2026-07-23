// Mehrsprachigkeit.
//
// Umfang bewusst begrenzt und begründet: Übersetzt ist die BEDIENFLÄCHE
// (Navigation, Überschriften, wiederkehrende Aktionen). NICHT übersetzt sind
// die rechtlichen Inhalte — sie zitieren deutsches Luftrecht (LuftVO, LBA,
// dipul, EU-VO 2019/947 in deutscher Fassung). Eine englische Nacherzählung
// davon wäre inhaltlich riskant, weil verbindlich immer der deutsche Text ist.
//
// Neue Sprache: einen Schlüssel je Eintrag ergänzen. Fehlt eine Übersetzung,
// fällt die Anzeige auf Deutsch zurück statt den Schlüssel zu zeigen.

export type Sprache = 'de' | 'en';

const KEY = 'skylog_sprache';

type Eintrag = { de: string; en: string };

export const TEXTE = {
  // Navigation
  'nav.karte': { de: 'Karte', en: 'Map' },
  'nav.garage': { de: 'Garage', en: 'Hangar' },
  'nav.logbuch': { de: 'Logbuch', en: 'Logbook' },
  'nav.inventar': { de: 'Inventar', en: 'Inventory' },
  'nav.piloten': { de: 'Piloten', en: 'Pilots' },
  'nav.lbaInfo': { de: 'LBA Info', en: 'Regulations' },
  'nav.safety': { de: 'Safety', en: 'Safety' },
  'nav.profil': { de: 'Profil', en: 'Profile' },

  // Kopfzeile
  'app.untertitel': { de: 'LBA Info & Flight Log', en: 'Regulations & Flight Log' },
  'app.konform': { de: 'LBA Konform', en: 'Compliant' },

  // Überschriften der Ansichten
  'view.flotte': { de: 'Flotte', en: 'Fleet' },
  'view.akkus': { de: 'Akkus', en: 'Batteries' },
  'view.logbuch': { de: 'Logbuch', en: 'Logbook' },
  'view.safetyHub': { de: 'Safety Hub', en: 'Safety Hub' },
  'view.profil': { de: 'Piloten Profil', en: 'Pilot Profile' },

  // Wiederkehrende Aktionen
  'aktion.speichern': { de: 'Speichern', en: 'Save' },
  'aktion.abbrechen': { de: 'Abbrechen', en: 'Cancel' },
  'aktion.loeschen': { de: 'Löschen', en: 'Delete' },
  'aktion.schliessen': { de: 'Schließen', en: 'Close' },
  'aktion.hinzufuegen': { de: 'Hinzufügen', en: 'Add' },

  // Bedienhilfen (aria-labels)
  'a11y.themaHell': { de: 'Helles Design', en: 'Light theme' },
  'a11y.themaDunkel': { de: 'Dunkles Design', en: 'Dark theme' },
  'a11y.behoerdenCheck': { de: 'Behörden-Check anzeigen', en: 'Show authority check' },
  'a11y.sprache': { de: 'Sprache wechseln', en: 'Switch language' },
  'a11y.planer': { de: 'Flugplaner öffnen', en: 'Open flight planner' },
} satisfies Record<string, Eintrag>;

export type TextKey = keyof typeof TEXTE;

/** Übersetzt einen Schlüssel. Fehlt die Sprache, kommt Deutsch zurück;
 *  fehlt der Schlüssel ganz, kommt der Schlüssel selbst (macht Lücken
 *  sichtbar, statt leer zu rendern). */
export function uebersetze(key: string, sprache: Sprache): string {
  const eintrag = (TEXTE as Record<string, Eintrag>)[key];
  if (!eintrag) return key;
  return eintrag[sprache] || eintrag.de;
}

export function systemSprache(): Sprache {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'de';
  return nav?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function ladeSprache(): Sprache {
  try {
    const gespeichert = localStorage.getItem(KEY);
    if (gespeichert === 'de' || gespeichert === 'en') return gespeichert;
  } catch { /* ignore */ }
  return systemSprache();
}

export function setzeSprache(sprache: Sprache): void {
  try { localStorage.setItem(KEY, sprache); } catch { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', sprache);
  }
}

export function andereSprache(aktuell: Sprache): Sprache {
  return aktuell === 'de' ? 'en' : 'de';
}
