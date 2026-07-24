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

/** Deutschland als überlappendes 2×2-Raster: So lädt niemand das ganze Land,
 *  nur um in seiner Ecke zu fliegen. Zoom 13 ist der Kompromiss zwischen
 *  Detail im Feld und Dateigröße.
 *
 *  Die Kästen überlappen bewusst (~0,5°). Ein erster Versuch mit fünf knapp
 *  zugeschnittenen Regionen hatte ein Loch bei Hannover — überlappende
 *  Quadranten sind gegen solche Lücken unempfindlich, und der Test unten
 *  prüft die Fläche systematisch ab. */
export const REGIONEN: KartenRegion[] = [
  {
    code: 'de-nordwest', name: 'Deutschland Nordwest',
    bbox: { minLon: 5.8, minLat: 51.0, maxLon: 10.5, maxLat: 55.1 },
    maxZoom: 13, datei: 'de-nordwest-z13.pmtiles',
  },
  {
    code: 'de-nordost', name: 'Deutschland Nordost',
    bbox: { minLon: 10.0, minLat: 51.0, maxLon: 15.1, maxLat: 55.1 },
    maxZoom: 13, datei: 'de-nordost-z13.pmtiles',
  },
  {
    code: 'de-suedwest', name: 'Deutschland Südwest',
    bbox: { minLon: 5.8, minLat: 47.2, maxLon: 10.5, maxLat: 51.5 },
    maxZoom: 13, datei: 'de-suedwest-z13.pmtiles',
  },
  {
    code: 'de-suedost', name: 'Deutschland Südost',
    bbox: { minLon: 10.0, minLat: 47.2, maxLon: 15.1, maxLat: 51.5 },
    maxZoom: 13, datei: 'de-suedost-z13.pmtiles',
  },
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
