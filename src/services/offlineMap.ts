// Offline-Karte, Stufe 1: die reine Kachel-Mathematik.
//
// Ein Offline-Gebiet ist eine Menge Karten-Kacheln (z/x/y) über einen Zoom-
// Bereich. Diese Datei rechnet aus, WELCHE Kacheln ein Gebiet abdeckt und wie
// groß der Download ungefähr wird — bewusst ohne Netz, ohne IndexedDB, ohne
// Karte, damit sie testbar ist. Das Herunterladen (per PMTiles.getZxy), das
// Speichern (IndexedDB) und das Rendern (protomaps-leaflet) bauen darauf auf.
//
// Die Umrechnung ist die Standard-„Slippy Map"-Projektion (Web-Mercator),
// dieselbe, die OSM/Leaflet für z/x/y nutzt.

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface Kachel {
  z: number;
  x: number;
  y: number;
}

function begrenze(min: number, wert: number, max: number): number {
  return Math.max(min, Math.min(max, wert));
}

/** Längen-/Breitengrad → Kachel-x/y auf Zoomstufe z (Web-Mercator). */
export function lonLatZuKachel(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  // Breite auf den gültigen Mercator-Bereich beschränken, sonst läuft tan() weg.
  const latClamped = begrenze(-85.05112878, lat, 85.05112878);
  const latRad = (latClamped * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x: begrenze(0, x, n - 1), y: begrenze(0, y, n - 1) };
}

/** Grobe Zahl der Kacheln, die ein Gebiet auf einer Zoomstufe abdeckt. */
export function kachelanzahlAufZoom(bbox: BBox, z: number): number {
  const nw = lonLatZuKachel(bbox.minLon, bbox.maxLat, z); // Nordwest
  const se = lonLatZuKachel(bbox.maxLon, bbox.minLat, z); // Südost
  const breite = Math.abs(se.x - nw.x) + 1;
  const hoehe = Math.abs(se.y - nw.y) + 1;
  return breite * hoehe;
}

export interface Gebietsplan {
  kacheln: Kachel[];
  /** true, wenn wegen der Obergrenze nicht alle Zoomstufen aufgenommen wurden. */
  begrenzt: boolean;
  /** höchste tatsächlich aufgenommene Zoomstufe. */
  maxZoom: number;
}

/** Alle Kacheln eines Gebiets über den Zoombereich [minZ, maxZ].
 *
 *  maxKacheln deckelt die Gesamtzahl: Wird eine Zoomstufe den Deckel sprengen,
 *  bricht die Aufnahme davor ab (die feinste Stufe fällt weg, nicht das ganze
 *  Gebiet). So kann ein zu großzügiges Gebiet nicht den Speicher fluten. */
export function kachelnImGebiet(
  bbox: BBox,
  minZ: number,
  maxZ: number,
  maxKacheln = 20000
): Gebietsplan {
  const kacheln: Kachel[] = [];
  let begrenzt = false;
  let maxZoom = minZ;

  for (let z = minZ; z <= maxZ; z++) {
    const anzahl = kachelanzahlAufZoom(bbox, z);
    if (kacheln.length + anzahl > maxKacheln) {
      begrenzt = true;
      break;
    }
    const nw = lonLatZuKachel(bbox.minLon, bbox.maxLat, z);
    const se = lonLatZuKachel(bbox.maxLon, bbox.minLat, z);
    const x0 = Math.min(nw.x, se.x);
    const x1 = Math.max(nw.x, se.x);
    const y0 = Math.min(nw.y, se.y);
    const y1 = Math.max(nw.y, se.y);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        kacheln.push({ z, x, y });
      }
    }
    maxZoom = z;
  }

  return { kacheln, begrenzt, maxZoom };
}

/** Grobe Downloadgröße. Vektorkacheln liegen erfahrungsgemäß bei ~15–40 kB;
 *  25 kB als runder Mittelwert, damit die Anzeige eher zu hoch als zu niedrig
 *  schätzt. */
export function schaetzeGroesseBytes(kachelanzahl: number, proKachel = 25000): number {
  return kachelanzahl * proKachel;
}

/** "12,3 MB" oder "840 kB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
