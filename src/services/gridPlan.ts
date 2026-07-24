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
