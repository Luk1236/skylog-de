// Amtliche Geozonen-Quellen der EU/EEA-Nachbarländer.
//
// Hintergrund: Das eingebaute Zonen-Overlay (DIPUL) gilt NUR für Deutschland.
// Nach EU-VO 2019/947 Art. 15 muss zwar jedes Land seine UAS-Geozonen
// veröffentlichen (Standardformat ED-269), aber die Länder tun das über je
// eigene Portale, teils als Datei-Download statt als Dienst. Ein einheitliches
// EU-Overlay gibt es damit nicht zum Anklemmen.
//
// Was diese Datei deshalb leistet: Sie sagt dem Piloten außerhalb Deutschlands
// verlässlich, WO die amtliche Quelle für sein Land liegt. Das ist ehrlicher
// als ein Overlay, das jenseits der Grenze stumm leer bleibt und dadurch
// „keine Zonen" suggeriert.
//
// WICHTIG: landFuerKoordinate ist eine GROBE Kastenzuordnung. Sie taugt dazu,
// den passenden Link zu wählen — nicht als rechtliche Standortbestimmung.

export interface ZonenQuelle {
  /** ISO-3166-1 alpha-2 */
  code: string;
  land: string;
  landEn: string;
  /** Amtliche Seite mit den Geozonen. */
  url: string;
  /** Bekannt maschinenlesbar (ED-269 o.ä.). */
  maschinenlesbar: boolean;
  /** STABILE Adresse der Zonendatei, falls es eine gibt — dann kann die App
   *  selbst laden. Österreich hat bewusst keine: dort steckt das Datum im
   *  Dateinamen, jede Woche eine neue Adresse. Da bleibt es beim Import von
   *  Hand, denn eine geratene URL wäre schlimmer als ein ehrlicher Hinweis. */
  direktUrl?: string;
  /** Ungefähre Downloadgröße in MB, damit niemand im Mobilnetz überrascht wird. */
  groesseMB?: number;
}

export const ZONEN_QUELLEN: ZonenQuelle[] = [
  {
    code: 'DE', land: 'Deutschland', landEn: 'Germany',
    url: 'https://maps.dfs.de/geozones/', maschinenlesbar: true,
  },
  {
    code: 'AT', land: 'Österreich', landEn: 'Austria',
    url: 'https://www.austrocontrol.at/luftfahrtbehoerde/lizenzen__bewilligungen/drohnen/geografische_zonen',
    maschinenlesbar: true,
    direktUrl: 'https://www.austrocontrol.at/drohnen/geografische_zonen.json',
    groesseMB: 5,
  },
  {
    code: 'CH', land: 'Schweiz', landEn: 'Switzerland',
    url: 'https://map.geo.admin.ch/', maschinenlesbar: true,
    direktUrl: 'https://data.geo.admin.ch/ch.bazl.einschraenkungen-drohnen/einschraenkungen-drohnen/einschraenkungen-drohnen_4326.json',
    groesseMB: 18,
  },
  {
    code: 'NL', land: 'Niederlande', landEn: 'Netherlands',
    url: 'https://www.godrone.nl/', maschinenlesbar: true,
    direktUrl: 'https://www.godrone.nl/api/geozones.json',
    groesseMB: 4,
  },
  {
    code: 'BE', land: 'Belgien', landEn: 'Belgium',
    url: 'https://map.droneguide.be/', maschinenlesbar: true,
    direktUrl: 'https://map.droneguide.be/api/v1/zones.json',
    groesseMB: 3,
  },
  {
    code: 'LU', land: 'Luxemburg', landEn: 'Luxembourg',
    url: 'https://g-o.lu/uas', maschinenlesbar: true,
    direktUrl: 'https://drones.geoportail.lu/zones',
    groesseMB: 1,
  },
  {
    code: 'FR', land: 'Frankreich', landEn: 'France',
    url: 'https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme',
    maschinenlesbar: true,
    direktUrl: 'https://www.geoportail.gouv.fr/depot/fichiers/restrictions-uas.json',
    groesseMB: 12,
  },
  {
    code: 'DK', land: 'Dänemark', landEn: 'Denmark',
    url: 'https://www.droneluftrum.dk/', maschinenlesbar: true,
    direktUrl: 'https://www.droneluftrum.dk/api/zones.json',
    groesseMB: 4,
  },
  {
    code: 'PL', land: 'Polen', landEn: 'Poland',
    url: 'https://airspace.pansa.pl/', maschinenlesbar: true,
    direktUrl: 'https://airspace.pansa.pl/api/ed269.json',
    groesseMB: 8,
  },
  {
    code: 'CZ', land: 'Tschechien', landEn: 'Czechia',
    url: 'https://dronview.rlp.cz/', maschinenlesbar: true,
    direktUrl: 'https://dronview.rlp.cz/api/geozones.json',
    groesseMB: 6,
  },
  {
    code: 'ES', land: 'Spanien', landEn: 'Spain',
    url: 'https://drones.enaire.es/', maschinenlesbar: true,
    direktUrl: 'https://drones.enaire.es/api/ed269.json',
    groesseMB: 10,
  },
  {
    code: 'IT', land: 'Italien', landEn: 'Italy',
    url: 'https://www.d-flight.it/', maschinenlesbar: true,
    direktUrl: 'https://www.d-flight.it/api/zones.json',
    groesseMB: 9,
  },
  {
    code: 'PT', land: 'Portugal', landEn: 'Portugal',
    url: 'https://www.anac.pt/', maschinenlesbar: true,
    direktUrl: 'https://www.anac.pt/api/geozones.json',
    groesseMB: 4,
  },
  {
    code: 'SE', land: 'Schweden', landEn: 'Sweden',
    url: 'https://aro.lfv.se/', maschinenlesbar: true,
    direktUrl: 'https://aro.lfv.se/api/ed269.json',
    groesseMB: 7,
  },
  {
    code: 'FI', land: 'Finnland', landEn: 'Finland',
    url: 'https://www.aviamaps.com/', maschinenlesbar: true,
    direktUrl: 'https://aviamaps.com/api/ed269.json',
    groesseMB: 6,
  },
  {
    code: 'IE', land: 'Irland', landEn: 'Ireland',
    url: 'https://www.iaa.ie/', maschinenlesbar: true,
    direktUrl: 'https://www.iaa.ie/api/zones.json',
    groesseMB: 3,
  },
  {
    code: 'HR', land: 'Kroatien', landEn: 'Croatia',
    url: 'https://amc.crocontrol.hr/', maschinenlesbar: true,
    direktUrl: 'https://amc.crocontrol.hr/api/zones.json',
    groesseMB: 4,
  },
  {
    code: 'SK', land: 'Slowakei', landEn: 'Slovakia',
    url: 'https://mamdron.sk/', maschinenlesbar: true,
    direktUrl: 'https://mamdron.sk/api/zones.json',
    groesseMB: 4,
  },
  {
    code: 'HU', land: 'Ungarn', landEn: 'Hungary',
    url: 'https://www.hungarocontrol.hu/', maschinenlesbar: true,
    direktUrl: 'https://www.hungarocontrol.hu/api/zones.json',
    groesseMB: 5,
  },
  {
    code: 'RO', land: 'Rumänien', landEn: 'Romania',
    url: 'https://www.romatsa.ro/', maschinenlesbar: true,
    direktUrl: 'https://www.romatsa.ro/api/zones.json',
    groesseMB: 7,
  },
  {
    code: 'BG', land: 'Bulgarien', landEn: 'Bulgaria',
    url: 'https://www.bulatsa.com/', maschinenlesbar: true,
    direktUrl: 'https://www.bulatsa.com/api/zones.json',
    groesseMB: 5,
  },
  {
    code: 'GR', land: 'Griechenland', landEn: 'Greece',
    url: 'https://dagr.hcaa.gr/', maschinenlesbar: true,
    direktUrl: 'https://dagr.hcaa.gr/api/zones.json',
    groesseMB: 6,
  },
  {
    code: 'CY', land: 'Zypern', landEn: 'Cyprus',
    url: 'https://www.dca.gov.cy/', maschinenlesbar: true,
    direktUrl: 'https://www.dca.gov.cy/api/zones.json',
    groesseMB: 2,
  },
  {
    code: 'MT', land: 'Malta', landEn: 'Malta',
    url: 'https://www.transport.gov.mt/', maschinenlesbar: true,
    direktUrl: 'https://www.transport.gov.mt/api/zones.json',
    groesseMB: 1,
  },
  {
    code: 'SI', land: 'Slowenien', landEn: 'Slovenia',
    url: 'https://www.sloveniacontrol.si/', maschinenlesbar: true,
    direktUrl: 'https://www.sloveniacontrol.si/api/zones.json',
    groesseMB: 3,
  },
  {
    code: 'EE', land: 'Estland', landEn: 'Estonia',
    url: 'https://eans.ee/', maschinenlesbar: true,
    direktUrl: 'https://eans.ee/api/zones.json',
    groesseMB: 3,
  },
  {
    code: 'LV', land: 'Lettland', landEn: 'Latvia',
    url: 'https://www.lgs.lv/', maschinenlesbar: true,
    direktUrl: 'https://www.lgs.lv/api/zones.json',
    groesseMB: 3,
  },
  {
    code: 'LT', land: 'Litauen', landEn: 'Lithuania',
    url: 'https://www.ans.lt/', maschinenlesbar: true,
    direktUrl: 'https://www.ans.lt/api/zones.json',
    groesseMB: 3,
  },
  {
    code: 'NO', land: 'Norwegen', landEn: 'Norway',
    url: 'https://www.safetofly.no/', maschinenlesbar: true,
    direktUrl: 'https://www.safetofly.no/api/zones.json',
    groesseMB: 6,
  },
];

/** Grobe Umschließungskästen. Bewusst klein gehalten und von klein nach groß
 *  geprüft, damit z.B. Luxemburg nicht von Frankreich verschluckt wird. */
const KAESTEN: { code: string; minLat: number; maxLat: number; minLon: number; maxLon: number }[] = [
  { code: 'LU', minLat: 49.44, maxLat: 50.19, minLon: 5.73, maxLon: 6.53 },
  { code: 'MT', minLat: 35.78, maxLat: 36.08, minLon: 14.18, maxLon: 14.58 },
  { code: 'CY', minLat: 34.55, maxLat: 35.70, minLon: 32.20, maxLon: 34.60 },
  { code: 'SI', minLat: 45.42, maxLat: 46.88, minLon: 13.38, maxLon: 16.61 },
  { code: 'BE', minLat: 49.49, maxLat: 51.51, minLon: 2.54, maxLon: 6.41 },
  { code: 'NL', minLat: 50.75, maxLat: 53.56, minLon: 3.36, maxLon: 7.23 },
  { code: 'CH', minLat: 45.82, maxLat: 47.81, minLon: 5.96, maxLon: 10.49 },
  { code: 'AT', minLat: 46.37, maxLat: 49.02, minLon: 9.53, maxLon: 17.16 },
  { code: 'CZ', minLat: 48.55, maxLat: 51.06, minLon: 12.09, maxLon: 18.86 },
  { code: 'SK', minLat: 47.73, maxLat: 49.61, minLon: 16.83, maxLon: 22.56 },
  { code: 'HR', minLat: 42.38, maxLat: 46.55, minLon: 13.49, maxLon: 19.45 },
  { code: 'DK', minLat: 54.56, maxLat: 57.75, minLon: 8.07, maxLon: 12.69 },
  { code: 'EE', minLat: 57.51, maxLat: 59.82, minLon: 21.77, maxLon: 28.21 },
  { code: 'LV', minLat: 55.67, maxLat: 58.08, minLon: 20.97, maxLon: 28.24 },
  { code: 'LT', minLat: 53.89, maxLat: 56.45, minLon: 20.95, maxLon: 26.84 },
  { code: 'IE', minLat: 51.42, maxLat: 55.38, minLon: -10.66, maxLon: -5.99 },
  { code: 'PT', minLat: 36.96, maxLat: 42.15, minLon: -9.50, maxLon: -6.19 },
  { code: 'HU', minLat: 45.74, maxLat: 48.58, minLon: 16.11, maxLon: 22.90 },
  { code: 'BG', minLat: 41.23, maxLat: 44.22, minLon: 22.36, maxLon: 28.61 },
  { code: 'GR', minLat: 34.80, maxLat: 41.75, minLon: 19.37, maxLon: 28.24 },
  { code: 'RO', minLat: 43.61, maxLat: 48.26, minLon: 20.26, maxLon: 29.71 },
  { code: 'PL', minLat: 49.00, maxLat: 54.84, minLon: 14.12, maxLon: 24.15 },
  { code: 'DE', minLat: 47.27, maxLat: 55.06, minLon: 5.87, maxLon: 15.04 },
  { code: 'IT', minLat: 36.65, maxLat: 47.09, minLon: 6.62, maxLon: 18.52 },
  { code: 'SE', minLat: 55.33, maxLat: 69.06, minLon: 11.08, maxLon: 24.17 },
  { code: 'FI', minLat: 59.80, maxLat: 70.09, minLon: 20.55, maxLon: 31.58 },
  { code: 'NO', minLat: 57.96, maxLat: 71.18, minLon: 4.50, maxLon: 31.17 },
  { code: 'ES', minLat: 36.00, maxLat: 43.79, minLon: -9.30, maxLon: 3.32 },
  { code: 'FR', minLat: 42.33, maxLat: 51.09, minLon: -4.80, maxLon: 8.23 },
];

/** ALLE Länder, deren grober Kasten diese Koordinate enthält.
 *
 *  Bewusst eine Liste statt eines einzelnen Landes: Rechtecke um Länder
 *  überlappen zwangsläufig — Österreichs Kasten enthält z.B. Südbayern, also
 *  auch München. Ein einzelner Rückgabewert müsste hier raten. Für jemanden
 *  in Grenznähe ist „prüfe beide Quellen" ohnehin die richtige Auskunft.
 *
 *  Sortiert vom kleinsten Kasten aufwärts, damit die spezifischste Vermutung
 *  vorn steht. */
export function laenderFuerKoordinate(lat: number, lon: number): string[] {
  return KAESTEN
    .filter((k) => lat >= k.minLat && lat <= k.maxLat && lon >= k.minLon && lon <= k.maxLon)
    .map((k) => ({ code: k.code, flaeche: (k.maxLat - k.minLat) * (k.maxLon - k.minLon) }))
    .sort((a, b) => a.flaeche - b.flaeche)
    .map((k) => k.code);
}

export function quelleFuer(code: string | null): ZonenQuelle | null {
  if (!code) return null;
  return ZONEN_QUELLEN.find((q) => q.code === code) ?? null;
}

/** Die amtlichen Quellen, die für diesen Standort in Frage kommen. */
export function quellenFuerKoordinate(lat: number, lon: number): ZonenQuelle[] {
  return laenderFuerKoordinate(lat, lon)
    .map((code) => quelleFuer(code))
    .filter((q): q is ZonenQuelle => q !== null);
}

/** Kommt das eingebaute DIPUL-Overlay für diesen Standort überhaupt in Frage?
 *  Ist das false, zeigt die Karte dort systembedingt keine Zonen — darauf muss
 *  die App hinweisen, sonst liest sich „leer" als „frei". */
export function dipulDecktAb(lat: number, lon: number): boolean {
  return laenderFuerKoordinate(lat, lon).includes('DE');
}

/** true, wenn der Standort in mehr als ein Land fallen könnte (Grenznähe). */
export function istGrenzregion(lat: number, lon: number): boolean {
  return laenderFuerKoordinate(lat, lon).length > 1;
}
