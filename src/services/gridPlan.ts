// Flächen-/Grid-Planung: aus einem rechteckigen Gebiet eine Mäander-Route
// (Boustrophedon) erzeugen — parallele Bahnen im Abstand des Kamera-Schwenks,
// im Zickzack verbunden. Das ist das Muster für Mapping-/Kartierungsflüge.
//
// Bewusst reine Berechnung ohne Karte oder DOM, damit sie testbar bleibt und
// die erzeugten Wegpunkte anschließend genauso exportiert werden können
// (GPX/KML) wie ein von Hand gesetzter Plan.
//
// Meter→Grad: Nord-Süd ist überall ~1/111320 Grad je Meter. Ost-West hängt von
// der Breite ab: 1/(111320·cos φ). In Deutschland (φ≈51°) ist ein Längengrad
// also deutlich kürzer als ein Breitengrad — diese Umrechnung ist der eigent
// liche Kern und der Grund, warum die Logik hier isoliert liegt.

import type { Wegpunkt } from './db';

const METER_PRO_GRAD_LAT = 111320;

export type Rasterrichtung = 'ost-west' | 'nord-sued';

export interface RasterOptionen {
  /** Abstand der Bahnen in Metern (Bahnabstand / Schwenkbreite). */
  bahnabstandM: number;
  /** Laufrichtung der Bahnen. 'ost-west' = Bahnen laufen ostwärts, versetzt
   *  nach Norden; 'nord-sued' = Bahnen laufen nordwärts, versetzt nach Osten. */
  richtung: Rasterrichtung;
  /** Obergrenze für die Bahnenzahl, damit ein winziger Abstand über einem
   *  großen Gebiet nicht Zehntausende Punkte erzeugt. */
  maxBahnen?: number;
}

export interface RasterErgebnis {
  wegpunkte: Wegpunkt[];
  /** Zahl der Bahnen (parallele Linien). */
  bahnen: number;
  /** true, wenn wegen maxBahnen der Abstand vergrößert wurde. */
  begrenzt: boolean;
}

function begrenze(min: number, wert: number, max: number): number {
  return Math.max(min, Math.min(max, wert));
}

/** Erzeugt aus zwei gegenüberliegenden Ecken eine Mäander-Route.
 *
 *  Die Ecken dürfen in beliebiger Reihenfolge/Lage kommen — es zählt nur das
 *  aufgespannte Rechteck. Die erste Bahn beginnt an der Ecke, die dem ersten
 *  übergebenen Punkt am nächsten liegt, damit der Start dort ist, wo man getippt
 *  hat. */
export function erzeugeRaster(
  ecke1: Wegpunkt,
  ecke2: Wegpunkt,
  opt: RasterOptionen
): RasterErgebnis {
  const maxBahnen = opt.maxBahnen ?? 200;

  const minLat = Math.min(ecke1.lat, ecke2.lat);
  const maxLat = Math.max(ecke1.lat, ecke2.lat);
  const minLon = Math.min(ecke1.lon, ecke2.lon);
  const maxLon = Math.max(ecke1.lon, ecke2.lon);

  // Entartetes Gebiet (Punkt oder Linie): nur die beiden Ecken zurückgeben.
  if (minLat === maxLat || minLon === maxLon) {
    return { wegpunkte: [ecke1, ecke2], bahnen: 1, begrenzt: false };
  }

  const mittelLat = (minLat + maxLat) / 2;
  const meterProGradLon = METER_PRO_GRAD_LAT * Math.cos((mittelLat * Math.PI) / 180);

  // Ausdehnung quer zur Bahnrichtung (dort wird versetzt) in Metern.
  const querMeter =
    opt.richtung === 'ost-west'
      ? (maxLat - minLat) * METER_PRO_GRAD_LAT   // versetzt nach Norden
      : (maxLon - minLon) * meterProGradLon;      // versetzt nach Osten

  let abstand = Math.max(1, opt.bahnabstandM);
  let bahnen = Math.floor(querMeter / abstand) + 1;
  let begrenzt = false;
  if (bahnen > maxBahnen) {
    bahnen = maxBahnen;
    abstand = querMeter / (bahnen - 1);
    begrenzt = true;
  }

  // Startecke: die dem ersten übergebenen Punkt nähere Kante bestimmt, ob wir
  // von der Süd-/West- oder Nord-/Ostkante her aufbauen.
  const wegpunkte: Wegpunkt[] = [];

  if (opt.richtung === 'ost-west') {
    const dLat = abstand / METER_PRO_GRAD_LAT;
    const startImNorden = Math.abs(ecke1.lat - maxLat) < Math.abs(ecke1.lat - minLat);
    const startImOsten = Math.abs(ecke1.lon - maxLon) < Math.abs(ecke1.lon - minLon);
    for (let i = 0; i < bahnen; i++) {
      const lat = begrenze(minLat, startImNorden ? maxLat - i * dLat : minLat + i * dLat, maxLat);
      // Serpentine: jede zweite Bahn andersherum, beginnend an der Startseite.
      const vorwaerts = i % 2 === 0 ? !startImOsten : startImOsten;
      const lonA = vorwaerts ? minLon : maxLon;
      const lonB = vorwaerts ? maxLon : minLon;
      wegpunkte.push({ lat, lon: lonA }, { lat, lon: lonB });
    }
  } else {
    const dLon = abstand / meterProGradLon;
    const startImOsten = Math.abs(ecke1.lon - maxLon) < Math.abs(ecke1.lon - minLon);
    const startImNorden = Math.abs(ecke1.lat - maxLat) < Math.abs(ecke1.lat - minLat);
    for (let i = 0; i < bahnen; i++) {
      const lon = begrenze(minLon, startImOsten ? maxLon - i * dLon : minLon + i * dLon, maxLon);
      const vorwaerts = i % 2 === 0 ? !startImNorden : startImNorden;
      const latA = vorwaerts ? minLat : maxLat;
      const latB = vorwaerts ? maxLat : minLat;
      wegpunkte.push({ lat: latA, lon }, { lat: latB, lon });
    }
  }

  return { wegpunkte, bahnen, begrenzt };
}

// ---------------------------------------------------------------------------
// Vieleck-Raster mit freier Flugrichtung
// ---------------------------------------------------------------------------
//
// Für echte Flächen (Feld, Baustelle, Dach): beliebiges Vieleck aus ≥ 3 Ecken,
// Bahnen in beliebiger Kompassrichtung. Vorgehen: Ecken in ein lokales
// Meter-Koordinatensystem um den Schwerpunkt projizieren, so drehen, dass die
// Bahnen waagerecht liegen, jede Bahn mit den Vieleck-Kanten schneiden, im
// Zickzack verbinden und zurück in Grad rechnen.
// Bei konkaven Flächen kann eine Bahn mehrere Stücke haben; die Verbindung
// dazwischen führt dann kurz über die Fläche hinaus.

export interface VieleckOptionen {
  /** Abstand der Bahnen in Metern. */
  bahnabstandM: number;
  /** Flugrichtung der Bahnen als Kompasskurs in Grad (0 = Nord-Süd, 90 = Ost-West). */
  richtungGrad: number;
  /** Flughöhe, die in jeden Wegpunkt geschrieben wird (optional). */
  hoeheM?: number;
  maxBahnen?: number;
}

/** Bahnabstand aus der Kamera: Bodenbreite eines Bildes = 2·h·tan(FOV/2),
 *  davon bleibt bei Seitenüberlappung ü nur der Anteil (1−ü) als Versatz. */
export function bahnabstandAusKamera(hoeheM: number, fovGrad: number, ueberlappungProzent: number): number {
  const breite = 2 * hoeheM * Math.tan((fovGrad * Math.PI) / 360);
  const anteil = 1 - Math.min(95, Math.max(0, ueberlappungProzent)) / 100;
  return Math.max(1, Math.round(breite * anteil));
}

export function erzeugeVieleckRaster(ecken: Wegpunkt[], opt: VieleckOptionen): RasterErgebnis {
  if (ecken.length < 3) {
    if (ecken.length === 2) {
      const r = erzeugeRaster(ecken[0], ecken[1], {
        bahnabstandM: opt.bahnabstandM,
        richtung: Math.abs(((opt.richtungGrad % 180) + 180) % 180 - 90) < 45 ? 'ost-west' : 'nord-sued',
        maxBahnen: opt.maxBahnen,
      });
      return opt.hoeheM ? { ...r, wegpunkte: r.wegpunkte.map(w => ({ ...w, alt: opt.hoeheM })) } : r;
    }
    return { wegpunkte: [...ecken], bahnen: 0, begrenzt: false };
  }

  const maxBahnen = opt.maxBahnen ?? 200;
  const lat0 = ecken.reduce((s, e) => s + e.lat, 0) / ecken.length;
  const lon0 = ecken.reduce((s, e) => s + e.lon, 0) / ecken.length;
  const mLon = METER_PRO_GRAD_LAT * Math.cos((lat0 * Math.PI) / 180);

  const theta = (opt.richtungGrad * Math.PI) / 180;
  const d = { x: Math.sin(theta), y: Math.cos(theta) };   // entlang der Bahn
  const n = { x: Math.cos(theta), y: -Math.sin(theta) };  // quer dazu

  const uv = ecken.map(e => {
    const x = (e.lon - lon0) * mLon;
    const y = (e.lat - lat0) * METER_PRO_GRAD_LAT;
    return { u: x * d.x + y * d.y, v: x * n.x + y * n.y };
  });
  const zuGrad = (u: number, v: number): Wegpunkt => {
    const x = u * d.x + v * n.x;
    const y = u * d.y + v * n.y;
    const w: Wegpunkt = { lat: lat0 + y / METER_PRO_GRAD_LAT, lon: lon0 + x / mLon };
    if (opt.hoeheM) w.alt = opt.hoeheM;
    return w;
  };

  const vMin = Math.min(...uv.map(p => p.v));
  const vMax = Math.max(...uv.map(p => p.v));
  const breite = vMax - vMin;
  if (breite <= 0) return { wegpunkte: [...ecken], bahnen: 0, begrenzt: false };

  let abstand = Math.max(1, opt.bahnabstandM);
  // kleine Toleranz: 100 m / 25 m darf durch Rundung nicht zu 5 Bahnen werden
  let bahnen = Math.max(1, Math.ceil(breite / abstand - 1e-6));
  let begrenzt = false;
  if (bahnen > maxBahnen) {
    bahnen = maxBahnen;
    abstand = breite / bahnen;
    begrenzt = true;
  }
  // Bahnen mittig im Streifen: halber Abstand zum Rand, damit die äußeren
  // Bilder die Kante noch abdecken, ohne weit darüber hinauszufliegen.
  const rand = (breite - (bahnen - 1) * abstand) / 2;

  const linien: { u: number; v: number }[][][] = [];
  for (let i = 0; i < bahnen; i++) {
    const v = vMin + rand + i * abstand;
    const us: number[] = [];
    for (let k = 0; k < uv.length; k++) {
      const a = uv[k];
      const b = uv[(k + 1) % uv.length];
      if ((a.v <= v && v < b.v) || (b.v <= v && v < a.v)) {
        us.push(a.u + ((v - a.v) * (b.u - a.u)) / (b.v - a.v));
      }
    }
    us.sort((p, q) => p - q);
    const stuecke: { u: number; v: number }[][] = [];
    for (let k = 0; k + 1 < us.length; k += 2) stuecke.push([{ u: us[k], v }, { u: us[k + 1], v }]);
    if (stuecke.length) linien.push(stuecke);
  }

  // Zickzack: jede zweite Bahn rückwärts (Stücke und Punkte umdrehen).
  const baue = (vonOben: boolean, ersteRueckwaerts: boolean): Wegpunkt[] => {
    const reihen = vonOben ? [...linien].reverse() : linien;
    const pkt: Wegpunkt[] = [];
    reihen.forEach((stuecke, i) => {
      const rueck = (i % 2 === 1) !== ersteRueckwaerts;
      const folge = rueck ? [...stuecke].reverse().map(s => [s[1], s[0]]) : stuecke;
      for (const s of folge) pkt.push(zuGrad(s[0].u, s[0].v), zuGrad(s[1].u, s[1].v));
    });
    return pkt;
  };

  // Start dort, wo der erste Eckpunkt gesetzt wurde.
  const start = ecken[0];
  const abstandZumStart = (w: Wegpunkt | undefined) =>
    w ? Math.hypot((w.lat - start.lat) * METER_PRO_GRAD_LAT, (w.lon - start.lon) * mLon) : Infinity;
  const varianten = [baue(false, false), baue(false, true), baue(true, false), baue(true, true)];
  const beste = varianten.reduce((a, b) => (abstandZumStart(b[0]) < abstandZumStart(a[0]) ? b : a));

  return { wegpunkte: beste, bahnen: linien.length, begrenzt };
}
