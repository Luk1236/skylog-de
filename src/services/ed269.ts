// ED-269: Geozonen anderer EU-Länder einlesen.
//
// ED-269 ist das von EASA vorgegebene Austauschformat für UAS-Geozonen; nach
// EU-VO 2019/947 Art. 15 muss jedes Mitgliedsland seine Zonen veröffentlichen.
// Das eingebaute Overlay (dipul) deckt nur Deutschland ab — hierüber kommen
// die Zonen der Nachbarländer in die App.
//
// Struktur am 2026-07-24 gegen eine echte Datei von Austro Control geprüft
// (UASZones-ACG-…-full-production.json, 286 Zonen). Wichtige Abweichungen von
// dem, was man erwarten würde:
//   • Top-Level ist ein ARRAY von Zonen, kein Objekt mit "features".
//   • Die Datei beginnt mit einem UTF-8-BOM — JSON.parse scheitert daran.
//   • Höhen stehen je Geometrie, nicht je Zone.
//   • Koordinaten sind [lon, lat] (GeoJSON), Leaflet erwartet [lat, lon].
//
// Bewusst KEIN automatischer Abruf: Die Dateinamen der Behörden tragen ein
// Datum und ändern sich, und eine stillschweigend veraltete Zonendatei wäre
// gefährlicher als gar keine. Der Pilot importiert die aktuelle Datei selbst.

export type Beschraenkung =
  | 'PROHIBITED'
  | 'REQ_AUTHORISATION'
  | 'CONDITIONAL'
  | 'NO_RESTRICTION';

export interface Ed269Zone {
  id: string;
  name: string;
  /** ISO-3166-1 alpha-3, z.B. "AUT". */
  land: string;
  beschraenkung: Beschraenkung;
  gruende: string[];
  hinweis: string;
  /** Ringe in Leaflet-Reihenfolge [lat, lon]. */
  polygone: [number, number][][];
  untergrenzeM?: number;
  obergrenzeM?: number;
}

/** Fuß in Meter — manche Länder liefern uomDimensions "FT". */
function inMeter(wert: unknown, einheit: unknown): number | undefined {
  const z = typeof wert === 'number' ? wert : Number(wert);
  if (!Number.isFinite(z)) return undefined;
  return String(einheit).toUpperCase() === 'FT' ? Math.round(z * 0.3048) : z;
}

function istBeschraenkung(w: unknown): w is Beschraenkung {
  return w === 'PROHIBITED' || w === 'REQ_AUTHORISATION' || w === 'CONDITIONAL' || w === 'NO_RESTRICTION';
}

/** Kreis zu einem Ring annähern — ED-269 erlaubt neben Polygon auch Circle. */
function kreisAlsRing(lat: number, lon: number, radiusM: number, punkte = 24): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  for (let i = 0; i <= punkte; i++) {
    const w = (i / punkte) * 2 * Math.PI;
    ring.push([lat + dLat * Math.sin(w), lon + dLon * Math.cos(w)]);
  }
  return ring;
}

/** Liest eine ED-269-Datei. Wirft mit klarer Meldung, wenn es keine ist. */
export function parseEd269(text: string): Ed269Zone[] {
  // BOM entfernen — die österreichische Datei hat eines, JSON.parse stolpert.
  const sauber = text.replace(/^﻿/, '').trim();
  let roh: unknown;
  try {
    roh = JSON.parse(sauber);
  } catch {
    throw new Error('Das ist keine gültige JSON-Datei.');
  }
  if (!Array.isArray(roh)) {
    throw new Error('Keine ED-269-Datei: erwartet wird eine Liste von Zonen.');
  }

  const zonen: Ed269Zone[] = [];
  for (const e of roh as Record<string, any>[]) {
    if (!e || typeof e !== 'object') continue;
    const geo = Array.isArray(e.geometry) ? e.geometry : [];
    const polygone: [number, number][][] = [];
    let unten: number | undefined;
    let oben: number | undefined;

    for (const g of geo) {
      const hp = g?.horizontalProjection;
      if (hp?.type === 'Polygon' && Array.isArray(hp.coordinates)) {
        for (const ring of hp.coordinates) {
          if (!Array.isArray(ring)) continue;
          // [lon, lat] -> [lat, lon]
          const gedreht = ring
            .filter((p: unknown) => Array.isArray(p) && p.length >= 2)
            .map((p: number[]) => [p[1], p[0]] as [number, number]);
          if (gedreht.length >= 3) polygone.push(gedreht);
        }
      } else if (hp?.type === 'Circle' && Array.isArray(hp.center)) {
        const r = Number(hp.radius);
        if (Number.isFinite(r)) polygone.push(kreisAlsRing(hp.center[1], hp.center[0], r));
      }
      const u = inMeter(g?.lowerLimit, g?.uomDimensions);
      const o = inMeter(g?.upperLimit, g?.uomDimensions);
      if (u !== undefined) unten = unten === undefined ? u : Math.min(unten, u);
      if (o !== undefined) oben = oben === undefined ? o : Math.max(oben, o);
    }

    if (polygone.length === 0) continue; // ohne Fläche nicht darstellbar

    zonen.push({
      id: String(e.zoneId ?? e.identifier ?? `zone-${zonen.length}`),
      name: String(e.name ?? e.identifier ?? 'Unbenannte Zone'),
      land: String(e.country ?? '').toUpperCase(),
      beschraenkung: istBeschraenkung(e.restriction) ? e.restriction : 'CONDITIONAL',
      gruende: Array.isArray(e.reason) ? e.reason.map(String) : [],
      hinweis: String(e.message ?? ''),
      polygone,
      untergrenzeM: unten,
      obergrenzeM: oben,
    });
  }
  return zonen;
}

/** Punkt-in-Polygon (Strahlenverfahren) auf [lat, lon]-Ringen. */
export function punktInRing(ring: [number, number][], lat: number, lon: number): boolean {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lat1, lon1] = ring[i];
    const [lat2, lon2] = ring[j];
    const schneidet = lon1 > lon !== lon2 > lon
      && lat < ((lat2 - lat1) * (lon - lon1)) / (lon2 - lon1) + lat1;
    if (schneidet) drin = !drin;
  }
  return drin;
}

/** Alle Zonen, die diesen Punkt enthalten. */
export function zonenAnPunkt(zonen: Ed269Zone[], lat: number, lon: number): Ed269Zone[] {
  return zonen.filter((z) => z.polygone.some((r) => punktInRing(r, lat, lon)));
}

export type Stufe = 'frei' | 'hinweis' | 'kritisch';

/** Beschränkung auf die Ampel der App abbilden. CONDITIONAL bewusst als
 *  Hinweis und nicht als frei: „unter Bedingungen" heißt, dass es welche gibt. */
export function stufeFuer(b: Beschraenkung): Stufe {
  if (b === 'PROHIBITED') return 'kritisch';
  if (b === 'REQ_AUTHORISATION' || b === 'CONDITIONAL') return 'hinweis';
  return 'frei';
}

/** Gesamturteil: Die strengste Zone gewinnt. */
export function bewerteZonen(zonen: Ed269Zone[]): Stufe {
  if (zonen.some((z) => stufeFuer(z.beschraenkung) === 'kritisch')) return 'kritisch';
  if (zonen.some((z) => stufeFuer(z.beschraenkung) === 'hinweis')) return 'hinweis';
  return 'frei';
}
