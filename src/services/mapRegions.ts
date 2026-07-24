// Karten-Regionen: Was es zum Herunterladen gibt und woher.
//
// Konzept: Die Kartendateien (PMTiles) liegen als GitHub-Release-Assets. Die
// App zeigt den Katalog, der Nutzer lädt nur die Region, die er braucht.
//
// Warum GitHub-Release und nicht Pages: Release-Assets erlauben 2 GB pro Datei
// und unterstützen HTTP-Range (am 2026-07-24 gegen einen echten Asset geprüft:
// 206 Partial Content, Accept-Ranges: bytes). GitHub Pages begrenzt auf 100 MB
// pro Datei und wäre damit ausgeschieden.
//
// Warum kein Vorab-Bundle in der APK: Ganz Deutschland wäre schon bei mittlerer
// Detailstufe mehrere hundert MB, ganz EU im GB-Bereich. Herunterladen bei
// Bedarf hält die App klein und lässt die Wahl beim Nutzer.

import type { BBox } from './offlineMap';

export interface KartenRegion {
  /** Stabiler Bezeichner, auch der Speicher-Schlüssel. */
  code: string;
  name: string;
  bbox: BBox;
  /** Detailstufe, mit der die Datei erzeugt wurde. */
  maxZoom: number;
  /** Dateiname des Release-Assets. */
  datei: string;
}

/** Basis-URL der Release-Assets. Tag bewusst versioniert, damit neue
 *  Kartenstände die alten nicht still ersetzen. */
export const RELEASE_BASIS =
  'https://github.com/Luk1236/skylog-de/releases/download/karten-v1';

/** Deutschland als überlappendes 4×4-Raster.
 *
 *  Warum so klein geschnitten: Gemessen am 2026-07-24 kostet ein Viertel des
 *  Landes bei Zoom 13 rund 600 MB — zu viel für einen Handy-Download und
 *  grenzwertig für den Browser-Speicher. Ein Sechzehntel kostet rund 150 MB
 *  bei UNVERÄNDERTER Detailstufe. Kleiner schneiden ist deshalb besser als
 *  gröber rendern: Man lädt weniger und sieht trotzdem mehr, weil nur das
 *  wirklich gebrauchte Gebiet auf dem Gerät landet.
 *
 *  Die Kästen überlappen (~0,3°). Ein früherer Versuch mit knapp
 *  zugeschnittenen Regionen hatte ein Loch bei Hannover; der Flächentest
 *  unten rastert die Abdeckung deshalb systematisch ab. */
// ACHTUNG: `code` und `datei` sind historische Bezeichner aus dem ersten
// Entwurf und stimmen NICHT immer mit dem Ort im Namen überein — `de-berlin`
// enthält z.B. Magdeburg/Leipzig, Berlin liegt in `de-brandenburg-ost`. Die
// Namen wurden korrigiert, die Dateinamen nicht, weil die Assets bereits
// hochgeladen sind. Verbindlich sind immer `name` und `bbox`; der Test unten
// hält beide zusammen.
export const REGIONEN: KartenRegion[] = [
  // Nord (52,9–55,1)
  { code: 'de-nordsee', name: 'Nordseeküste / Ostfriesland',
    bbox: { minLon: 5.8, minLat: 52.9, maxLon: 8.3, maxLat: 55.1 }, maxZoom: 13, datei: 'de-nordsee-z13.pmtiles' },
  { code: 'de-hamburg', name: 'Hamburg / Bremen / Kiel',
    bbox: { minLon: 8.0, minLat: 52.9, maxLon: 10.5, maxLat: 55.1 }, maxZoom: 13, datei: 'de-hamburg-z13.pmtiles' },
  { code: 'de-mecklenburg', name: 'Mecklenburg / Lübeck',
    bbox: { minLon: 10.2, minLat: 52.9, maxLon: 12.7, maxLat: 55.1 }, maxZoom: 13, datei: 'de-mecklenburg-z13.pmtiles' },
  { code: 'de-vorpommern', name: 'Vorpommern / Rügen',
    bbox: { minLon: 12.4, minLat: 52.9, maxLon: 15.1, maxLat: 55.1 }, maxZoom: 13, datei: 'de-vorpommern-z13.pmtiles' },

  // Nord-Mitte (51,0–53,2)
  { code: 'de-muensterland', name: 'Münsterland / Osnabrück',
    bbox: { minLon: 5.8, minLat: 51.0, maxLon: 8.3, maxLat: 53.2 }, maxZoom: 13, datei: 'de-muensterland-z13.pmtiles' },
  { code: 'de-hannover', name: 'Hannover / Bielefeld / Kassel',
    bbox: { minLon: 8.0, minLat: 51.0, maxLon: 10.5, maxLat: 53.2 }, maxZoom: 13, datei: 'de-hannover-z13.pmtiles' },
  { code: 'de-berlin', name: 'Magdeburg / Braunschweig / Leipzig',
    bbox: { minLon: 10.2, minLat: 51.0, maxLon: 12.7, maxLat: 53.2 }, maxZoom: 13, datei: 'de-berlin-z13.pmtiles' },
  { code: 'de-brandenburg-ost', name: 'Berlin / Potsdam / Cottbus',
    bbox: { minLon: 12.4, minLat: 51.0, maxLon: 15.1, maxLat: 53.2 }, maxZoom: 13, datei: 'de-brandenburg-ost-z13.pmtiles' },

  // Süd-Mitte (49,1–51,3)
  { code: 'de-koeln', name: 'Köln / Bonn / Trier / Saarbrücken',
    bbox: { minLon: 5.8, minLat: 49.1, maxLon: 8.3, maxLat: 51.3 }, maxZoom: 13, datei: 'de-koeln-z13.pmtiles' },
  { code: 'de-frankfurt', name: 'Frankfurt / Mainz / Würzburg',
    bbox: { minLon: 8.0, minLat: 49.1, maxLon: 10.5, maxLat: 51.3 }, maxZoom: 13, datei: 'de-frankfurt-z13.pmtiles' },
  { code: 'de-thueringen', name: 'Erfurt / Nürnberg / Jena',
    bbox: { minLon: 10.2, minLat: 49.1, maxLon: 12.7, maxLat: 51.3 }, maxZoom: 13, datei: 'de-thueringen-z13.pmtiles' },
  { code: 'de-dresden', name: 'Dresden / Chemnitz',
    bbox: { minLon: 12.4, minLat: 49.1, maxLon: 15.1, maxLat: 51.3 }, maxZoom: 13, datei: 'de-dresden-z13.pmtiles' },

  // Süd (47,2–49,4)
  { code: 'de-schwarzwald', name: 'Schwarzwald / Freiburg',
    bbox: { minLon: 5.8, minLat: 47.2, maxLon: 8.3, maxLat: 49.4 }, maxZoom: 13, datei: 'de-schwarzwald-z13.pmtiles' },
  { code: 'de-stuttgart', name: 'Stuttgart / Karlsruhe / Ulm',
    bbox: { minLon: 8.0, minLat: 47.2, maxLon: 10.5, maxLat: 49.4 }, maxZoom: 13, datei: 'de-stuttgart-z13.pmtiles' },
  { code: 'de-muenchen', name: 'München / Augsburg / Regensburg',
    bbox: { minLon: 10.2, minLat: 47.2, maxLon: 12.7, maxLat: 49.4 }, maxZoom: 13, datei: 'de-muenchen-z13.pmtiles' },
  { code: 'de-niederbayern', name: 'Niederbayern / Passau',
    bbox: { minLon: 12.4, minLat: 47.2, maxLon: 15.1, maxLat: 49.4 }, maxZoom: 13, datei: 'de-niederbayern-z13.pmtiles' },
];

export function regionFuerCode(code: string): KartenRegion | null {
  return REGIONEN.find((r) => r.code === code) ?? null;
}

/** Volle Download-URL des Release-Assets. */
export function regionUrl(region: KartenRegion, basis: string = RELEASE_BASIS): string {
  return `${basis}/${region.datei}`;
}

/** Abruf-URL je Plattform.
 *
 *  GitHub liefert zu den Assets KEINE CORS-Header (am 2026-07-24 geprüft).
 *  Nativ ist das gleichgültig, weil CapacitorHttp den Abruf am Browser vorbei
 *  macht. Im Web-Build muss derselbe Proxy davor wie bei den Wetterdaten,
 *  sonst blockt der Browser. */
export function quellUrl(region: KartenRegion, nativ: boolean): string {
  return nativ ? regionUrl(region) : `/api/karte/${region.datei}`;
}

/** Enthält die Region diese Koordinate? Für „welche brauche ich?". */
export function regionEnthaelt(region: KartenRegion, lat: number, lon: number): boolean {
  const b = region.bbox;
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

/** Regionen, die diesen Standort abdecken — meist eine, an Rändern zwei. */
export function regionenFuerStandort(lat: number, lon: number): KartenRegion[] {
  return REGIONEN.filter((r) => regionEnthaelt(r, lat, lon));
}
