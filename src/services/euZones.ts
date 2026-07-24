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
  },
  {
    code: 'CH', land: 'Schweiz', landEn: 'Switzerland',
    url: 'https://map.geo.admin.ch/', maschinenlesbar: true,
    // Stabile Adresse, sendet Access-Control-Allow-Origin: * (2026-07-24
    // geprueft) — die App kann direkt laden. Enthaelt auch Liechtenstein.
    direktUrl: 'https://data.geo.admin.ch/ch.bazl.einschraenkungen-drohnen/einschraenkungen-drohnen/einschraenkungen-drohnen_4326.json',
    groesseMB: 18,
  },
  {
    code: 'NL', land: 'Niederlande', landEn: 'Netherlands',
    url: 'https://www.godrone.nl/', maschinenlesbar: true,
  },
  {
    code: 'BE', land: 'Belgien', landEn: 'Belgium',
    url: 'https://map.droneguide.be/', maschinenlesbar: false,
  },
  {
    code: 'LU', land: 'Luxemburg', landEn: 'Luxembourg',
    url: 'https://g-o.lu/uas', maschinenlesbar: true,
    // Stabile Adresse, wird laut Portal alle 5 Minuten neu erzeugt.
    // Ohne CORS-Header, im Web also ueber den Proxy.
    direktUrl: 'https://drones.geoportail.lu/zones',
    groesseMB: 1,
  },
  {
    code: 'FR', land: 'Frankreich', landEn: 'France',
    url: 'https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme',
    maschinenlesbar: true,
  },
  {
    code: 'DK', land: 'Dänemark', landEn: 'Denmark',
    url: 'https://www.droneluftrum.dk/', maschinenlesbar: false,
  },
  {
    code: 'PL', land: 'Polen', landEn: 'Poland',
    url: 'https://airspace.pansa.pl/', maschinenlesbar: false,
  },
  {
    code: 'CZ', land: 'Tschechien', landEn: 'Czechia',
    url: 'https://dronview.rlp.cz/', maschinenlesbar: false,
  },
];

/** Grobe Umschließungskästen. Bewusst klein gehalten und von klein nach groß
 *  geprüft, damit z.B. Luxemburg nicht von Frankreich verschluckt wird. */
const KAESTEN: { code: string; minLat: number; maxLat: number; minLon: number; maxLon: number }[] = [
  { code: 'LU', minLat: 49.44, maxLat: 50.19, minLon: 5.73, maxLon: 6.53 },
  { code: 'BE', minLat: 49.49, maxLat: 51.51, minLon: 2.54, maxLon: 6.41 },
  { code: 'NL', minLat: 50.75, maxLat: 53.56, minLon: 3.36, maxLon: 7.23 },
  { code: 'CH', minLat: 45.82, maxLat: 47.81, minLon: 5.96, maxLon: 10.49 },
  { code: 'AT', minLat: 46.37, maxLat: 49.02, minLon: 9.53, maxLon: 17.16 },
  { code: 'CZ', minLat: 48.55, maxLat: 51.06, minLon: 12.09, maxLon: 18.86 },
  { code: 'DK', minLat: 54.56, maxLat: 57.75, minLon: 8.07, maxLon: 12.69 },
  { code: 'PL', minLat: 49.00, maxLat: 54.84, minLon: 14.12, maxLon: 24.15 },
  { code: 'DE', minLat: 47.27, maxLat: 55.06, minLon: 5.87, maxLon: 15.04 },
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
