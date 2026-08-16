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

  // Die Länder verpacken denselben Standard unterschiedlich: Österreich
  // liefert die Zonen als blankes Array, Luxemburg als Objekt mit "features"
  // (samt Titel und Beschreibung drumherum). Beides am 2026-07-24 gegen die
  // echten Dateien geprüft. Die Zonen SELBST sind in beiden gleich aufgebaut.
  let liste: unknown;
  if (Array.isArray(roh)) {
    liste = roh;
  } else if (roh && typeof roh === 'object') {
    const o = roh as Record<string, unknown>;
    liste = o.features ?? o.UASZoneVersion ?? o.zones;
  }
  if (!Array.isArray(liste)) {
    throw new Error('Keine ED-269-Datei: weder eine Liste von Zonen noch ein "features"-Feld gefunden.');
  }

  const zonen: Ed269Zone[] = [];
  for (const e of liste as Record<string, any>[]) {
    if (!e || typeof e !== 'object') continue;
    const polygone: [number, number][][] = [];
    let unten: number | undefined;
    let oben: number | undefined;

    const props = e.properties && typeof e.properties === 'object' ? { ...e.properties, ...e } : e;

    const verarbeiteGeometrie = (geom: any) => {
      if (!geom || typeof geom !== 'object') return;
      const hp = geom.horizontalProjection ?? geom;
      const type = hp.type;
      const coords = hp.coordinates;

      if (type === 'Polygon' && Array.isArray(coords)) {
        for (const ring of coords) {
          if (!Array.isArray(ring)) continue;
          const gedreht = ring
            .filter((p: unknown) => Array.isArray(p) && p.length >= 2)
            .map((p: number[]) => [Number(p[1]), Number(p[0])] as [number, number])
            .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
          if (gedreht.length >= 3) polygone.push(gedreht);
        }
      } else if (type === 'MultiPolygon' && Array.isArray(coords)) {
        for (const poly of coords) {
          if (!Array.isArray(poly)) continue;
          for (const ring of poly) {
            if (!Array.isArray(ring)) continue;
            const gedreht = ring
              .filter((p: unknown) => Array.isArray(p) && p.length >= 2)
              .map((p: number[]) => [Number(p[1]), Number(p[0])] as [number, number])
              .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
            if (gedreht.length >= 3) polygone.push(gedreht);
          }
        }
      } else if (type === 'Circle' && Array.isArray(hp.center)) {
        const r = Number(hp.radius);
        if (Number.isFinite(r)) polygone.push(kreisAlsRing(Number(hp.center[1]), Number(hp.center[0]), r));
      }

      const u = inMeter(geom.lowerLimit ?? props.lowerLimit, geom.uomDimensions ?? props.uomDimensions);
      const o = inMeter(geom.upperLimit ?? props.upperLimit, geom.uomDimensions ?? props.uomDimensions);
      if (u !== undefined) unten = unten === undefined ? u : Math.min(unten, u);
      if (o !== undefined) oben = oben === undefined ? o : Math.max(oben, o);
    };

    if (Array.isArray(e.geometry)) {
      for (const g of e.geometry) verarbeiteGeometrie(g);
    } else if (e.geometry) {
      verarbeiteGeometrie(e.geometry);
    } else {
      verarbeiteGeometrie(e);
    }

    if (polygone.length === 0) continue;

    const rawRes = String(props.restriction ?? props.type ?? props.status ?? '').toUpperCase();
    let beschraenkung: Beschraenkung = 'CONDITIONAL';
    if (rawRes.includes('PROHIBITED') || rawRes.includes('INTERDITE') || rawRes.includes('VERBOTEN') || rawRes.includes('RED')) {
      beschraenkung = 'PROHIBITED';
    } else if (rawRes.includes('AUTHORISATION') || rawRes.includes('PERMIT') || rawRes.includes('ORANGE')) {
      beschraenkung = 'REQ_AUTHORISATION';
    } else if (rawRes.includes('NO_RESTRICTION') || rawRes.includes('FREE')) {
      beschraenkung = 'NO_RESTRICTION';
    }

    zonen.push({
      id: String(props.zoneId ?? props.identifier ?? props.id ?? `zone-${zonen.length}`),
      name: String(props.name ?? props.identifier ?? props.nom ?? props.title ?? 'Unbenannte Zone'),
      land: String(props.country ?? props.land ?? 'EU').toUpperCase(),
      beschraenkung,
      gruende: Array.isArray(props.reason) ? props.reason.map(String) : (props.reason ? [String(props.reason)] : []),
      hinweis: String(props.message ?? props.description ?? ''),
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

/** Zonen in der Nähe eines Punktes — fürs Zeichnen auf der Karte.
 *
 *  Ohne diesen Filter würden alle Zonen eines Landes gerendert (Österreich:
 *  286 Polygone). Das ruckelt auf dem Handy und bringt nichts, weil ohnehin
 *  nur der Kartenausschnitt sichtbar ist. `maxAnzahl` ist die harte Bremse,
 *  falls jemand in einer Ballung sehr vieler Zonen steht. */
export function zonenInUmkreis(
  zonen: Ed269Zone[],
  lat: number,
  lon: number,
  gradRadius = 0.5,
  maxAnzahl = 200
): Ed269Zone[] {
  const nah = zonen.filter((z) =>
    z.polygone.some((ring) =>
      ring.some((p) => Math.abs(p[0] - lat) <= gradRadius && Math.abs(p[1] - lon) <= gradRadius)
    )
  );
  return nah.slice(0, maxAnzahl);
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
