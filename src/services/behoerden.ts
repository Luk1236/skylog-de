// Behörden- und Rechts-Verzeichnis für die „LBA Info"-Ansicht.
//
// Bündelt die amtlichen Anlaufstellen an einem Ort: deutsche Behörden, die
// EU-Ebene (EASA) und die zugrunde liegenden EU-Verordnungen. Die Länder-
// Behörden pro EU/EEA-Staat kommen bewusst NICHT hier hinein, sondern aus der
// bereits gepflegten Liste in euZones.ts (ZONEN_QUELLEN) — doppelte Pflege wäre
// eine Fehlerquelle.
//
// Grundsatz für die URLs: nur stabile, amtliche Adressen. EUR-Lex-Links nutzen
// die permanente CELEX-Kennung, die sich nicht ändert.

export interface Amtslink {
  name: string;
  beschreibung: string;
  url: string;
  /** Englische Fassung; fehlt nameEn/urlEn, gilt der deutsche Wert. */
  nameEn?: string;
  beschreibungEn: string;
  urlEn?: string;
}

/** Deutsche Behörden und amtliche Portale rund um die Drohne. */
export const DEUTSCHLAND_QUELLEN: Amtslink[] = [
  {
    name: 'Luftfahrt-Bundesamt (LBA) — Drohnen',
    beschreibung: 'Zuständige Bundesbehörde: Registrierung, Fernpilotenzeugnisse, Betriebserlaubnisse.',
    nameEn: 'Federal Aviation Office (LBA) — drones',
    beschreibungEn: 'Competent federal authority: registration, remote pilot certificates, operational authorisations.',
    url: 'https://www.lba.de/DE/Drohnen/Drohnen_node.html',
  },
  {
    name: 'DIPUL — Digitale Plattform Unbemannte Luftfahrt',
    beschreibung: 'Amtliches Portal des Bundes: Regeln, Betriebskategorien und interaktive Geozonen-Karte.',
    nameEn: 'DIPUL — Digital Platform for Unmanned Aviation',
    beschreibungEn: 'Official federal portal: rules, operating categories and an interactive geo-zone map.',
    url: 'https://www.dipul.de/homepage/de/',
  },
  {
    name: 'DFS — Drohnen-Geozonen (Karte)',
    beschreibung: 'Deutsche Flugsicherung: offizielle Karte der Flugbeschränkungs- und Geozonen.',
    nameEn: 'DFS — drone geo-zones (map)',
    beschreibungEn: 'German air navigation service provider: official map of flight restriction areas and geo-zones.',
    url: 'https://maptool-dipul.dfs.de/',
  },
  {
    name: 'LBA OpenUAV — Betreiber-Registrierung (e-ID)',
    beschreibung: 'Portal zur Registrierung als UAS-Betreiber und Vergabe der e-ID.',
    nameEn: 'LBA OpenUAV — operator registration (e-ID)',
    beschreibungEn: 'Portal for registering as a UAS operator and obtaining the e-ID.',
    url: 'https://uas-registration.lba-openuav.de',
  },
];

/** EU-Ebene: zentrale Anlaufstelle über alle Mitgliedstaaten. */
export const EU_QUELLEN: Amtslink[] = [
  {
    name: 'EASA — Civil Drones',
    beschreibung: 'Europäische Agentur für Flugsicherheit: EU-weite Regeln, Betriebskategorien und Drohnenklassen.',
    beschreibungEn: 'European Union Aviation Safety Agency: EU-wide rules, operating categories and drone classes.',
    url: 'https://www.easa.europa.eu/en/domains/civil-drones',
  },
];

/** Die maßgeblichen EU-Verordnungen im Volltext (EUR-Lex, deutsche Fassung). */
export const RECHTSGRUNDLAGEN: Amtslink[] = [
  {
    name: 'Durchführungs-VO (EU) 2019/947',
    beschreibung: 'Regeln und Verfahren für den Betrieb unbemannter Luftfahrzeuge (Betriebskategorien A1/A2/A3, STS).',
    url: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32019R0947',
    nameEn: 'Implementing Regulation (EU) 2019/947',
    beschreibungEn: 'Rules and procedures for operating unmanned aircraft (operating categories A1/A2/A3, STS).',
    urlEn: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019R0947',
  },
  {
    name: 'Delegierte VO (EU) 2019/945',
    beschreibung: 'Anforderungen an UAS und deren Produkte — die Drohnenklassen C0–C6.',
    url: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32019R0945',
    nameEn: 'Delegated Regulation (EU) 2019/945',
    beschreibungEn: 'Requirements for UAS and their products — the drone classes C0–C6.',
    urlEn: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019R0945',
  },
];
