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
  'nav.logbuch': { de: 'Logbuch', en: 'Logbook' },
  'nav.inventar': { de: 'Inventar', en: 'Inventory' },
  'nav.piloten': { de: 'Piloten', en: 'Pilots' },
  'nav.lbaInfo': { de: 'LBA Info', en: 'Regulations' },
  'nav.safety': { de: 'Safety', en: 'Safety' },
  'nav.profil': { de: 'Profil', en: 'Profile' },
  'nav.flotte': { de: 'Flotte', en: 'Fleet' },
  'nav.mehr': { de: 'Mehr', en: 'More' },

  // „Mehr"-Blatt
  'mehr.einstellungen': { de: 'Einstellungen', en: 'Settings' },
  'mehr.sprache': { de: 'Sprache', en: 'Language' },
  'mehr.design': { de: 'Design', en: 'Theme' },
  'mehr.hell': { de: 'Hell', en: 'Light' },
  'mehr.dunkel': { de: 'Dunkel', en: 'Dark' },

  // Kopfzeile
  'app.untertitel': { de: 'LBA Info & Flight Log', en: 'Regulations & Flight Log' },
  'app.konform': { de: 'LBA Konform', en: 'Compliant' },

  // Überschriften der Ansichten
  'view.flotte': { de: 'Flotte', en: 'Fleet' },
  'view.akkus': { de: 'Akkus', en: 'Batteries' },
  'view.logbuch': { de: 'Logbuch', en: 'Logbook' },
  'view.safetyHub': { de: 'Safety Hub', en: 'Safety Hub' },
  'view.profil': { de: 'Piloten Profil', en: 'Pilot Profile' },
  'view.roadmap': { de: 'Roadmap', en: 'Roadmap' },
  'view.lbaWissen': { de: 'LBA Wissen', en: 'Regulatory Knowledge' },
  'view.ersatzteile': { de: 'Ersatzteil-Katalog', en: 'Spare Part Catalogue' },
  'view.pilotenManagement': { de: 'Piloten-Management', en: 'Pilot Management' },

  // Flugplaner
  'planer.titel': { de: 'Flugplaner', en: 'Flight Planner' },
  'planer.hinweisKarte': { de: 'Auf die Karte tippen, um Wegpunkte zu setzen.', en: 'Tap the map to place waypoints.' },
  'planer.strecke': { de: 'Strecke', en: 'Distance' },
  'planer.flugzeit': { de: 'ca. Flugzeit', en: 'est. flight time' },
  'planer.maxEntfernung': { de: 'max. Entfernung', en: 'max. distance' },
  'planer.wegpunkte': { de: 'Wegpunkte', en: 'Waypoints' },
  'planer.alleLoeschen': { de: 'Alle löschen', en: 'Clear all' },
  'planer.gespeicherte': { de: 'Gespeicherte Pläne', en: 'Saved plans' },
  'planer.keinePlaene': { de: 'Noch keine Pläne gespeichert.', en: 'No plans saved yet.' },
  'planer.benennen': { de: 'Plan benennen…', en: 'Name this plan…' },
  'planer.loeschenFrage': { de: 'Diesen Flugplan löschen?', en: 'Delete this flight plan?' },
  'planer.exportieren': { de: 'Route exportieren', en: 'Export route' },
  'planer.fussnote': {
    de: 'Planungshilfe. GPX und KML lassen sich in Karten- und Flug-Apps oder Google Earth öffnen. Direkt an die Drohne senden geht nicht — dafür wären DJIs Waypoint-Format und das native SDK nötig.',
    en: 'Planning aid. GPX and KML open in mapping and flight apps or Google Earth. Sending directly to the drone is not possible — that would require DJI’s waypoint format and the native SDK.',
  },

  // Wiederkehrende Aktionen
  'aktion.speichern': { de: 'Speichern', en: 'Save' },
  'aktion.abbrechen': { de: 'Abbrechen', en: 'Cancel' },
  'aktion.loeschen': { de: 'Löschen', en: 'Delete' },
  'aktion.schliessen': { de: 'Schließen', en: 'Close' },

  // Wartung
  'wartung.eintragHinzufuegen': { de: 'Eintrag Hinzufügen', en: 'Add Entry' },

  // Bedienhilfen (aria-labels)
  'a11y.behoerdenCheck': { de: 'Behörden-Check anzeigen', en: 'Show authority check' },
  'a11y.planer': { de: 'Flugplaner öffnen', en: 'Open flight planner' },
  'a11y.gespeichertePlaene': { de: 'Gespeicherte Pläne', en: 'Saved plans' },
  'a11y.planLoeschen': { de: 'Plan löschen', en: 'Delete plan' },
  'a11y.wegpunktEntfernen': { de: 'Wegpunkt entfernen', en: 'Remove waypoint' },
  'a11y.nachOben': { de: 'Nach oben', en: 'Move up' },
  'a11y.nachUnten': { de: 'Nach unten', en: 'Move down' },
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
