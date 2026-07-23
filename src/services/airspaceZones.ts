// Luftraum-Zonen am Standort abfragen (dipul/DFS, WFS).
//
// Am 2026-07-23 gegen den Live-Dienst verifiziert. Drei Eigenheiten:
//  - Der Pfad heißt /geoservices/ (nicht /geoserver/).
//  - WFS 2.0 deutet mehrere typeNames als JOIN, nicht als Vereinigung. Man
//    muss deshalb PRO LAYER eine eigene Abfrage stellen und selbst mischen.
//  - Die bbox-Achsenreihenfolge hängt vom CRS ab: mit urn:...EPSG::4326 wäre
//    es lat,lon. Wir nutzen CRS84 — dort gilt lon,lat wie in GeoJSON.
//
// Der Dienst sendet Access-Control-Allow-Origin: *, der Aufruf läuft also
// direkt aus dem Browser, ohne Proxy.

const BASIS = 'https://uas-betrieb.de/geoservices/dipul/ows';

export type ZonenStufe = 'kritisch' | 'hinweis';

interface LayerDef {
  layer: string;
  label: string;
  stufe: ZonenStufe;
}

// Kuratierte Auswahl. „kritisch“ = Flug dort grundsätzlich untersagt oder nur
// mit Freigabe; „hinweis“ = Einschränkung/Auflage, die man kennen muss.
export const ZONEN_LAYER: LayerDef[] = [
  { layer: 'flugbeschraenkungsgebiete', label: 'Flugbeschränkungsgebiet', stufe: 'kritisch' },
  { layer: 'kontrollzonen',             label: 'Kontrollzone (CTR)',       stufe: 'kritisch' },
  { layer: 'flughaefen',                label: 'Flughafen',                stufe: 'kritisch' },
  { layer: 'flugplaetze',               label: 'Flugplatz',                stufe: 'kritisch' },
  { layer: 'militaerische_anlagen',     label: 'Militärische Anlage',      stufe: 'kritisch' },
  { layer: 'naturschutzgebiete',        label: 'Naturschutzgebiet',        stufe: 'hinweis' },
  { layer: 'nationalparks',             label: 'Nationalpark',             stufe: 'hinweis' },
  { layer: 'krankenhaeuser',            label: 'Krankenhaus',              stufe: 'hinweis' },
  { layer: 'justizvollzugsanstalten',   label: 'Justizvollzugsanstalt',    stufe: 'hinweis' },
  { layer: 'industrieanlagen',          label: 'Industrieanlage',          stufe: 'hinweis' },
  { layer: 'kraftwerke',                label: 'Kraftwerk',                stufe: 'hinweis' },
  { layer: 'freibaeder',                label: 'Freibad',                  stufe: 'hinweis' },
  { layer: 'bahnanlagen',               label: 'Bahnanlage',               stufe: 'hinweis' },
  { layer: 'stromleitungen',            label: 'Stromleitung',             stufe: 'hinweis' },
];

export interface Zone {
  layer: string;
  label: string;
  stufe: ZonenStufe;
  name: string;
  typeCode: string | null;
  untenWert: number | null;
  untenEinheit: string | null;
  untenBezug: string | null;   // AGL | MSL
  obenWert: number | null;
  obenEinheit: string | null;
  obenBezug: string | null;
  rechtsgrundlage: string | null;
}

/** bbox um einen Punkt, in CRS84-Reihenfolge (lon,lat). */
export function bboxUmPunkt(lat: number, lon: number, radiusM = 500): string {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return `${r(lon - dLon)},${r(lat - dLat)},${r(lon + dLon)},${r(lat + dLat)}`;
}

function zahlOderNull(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Ein WFS-Feature in unsere Form bringen. */
export function zuZone(feature: any, def: LayerDef): Zone {
  const p = feature?.properties ?? {};
  return {
    layer: def.layer,
    label: def.label,
    stufe: def.stufe,
    name: String(p.name ?? p.generated_name_DE ?? def.label),
    typeCode: p.type_code != null ? String(p.type_code) : null,
    untenWert: zahlOderNull(p.lower_limit_altitude),
    untenEinheit: p.lower_limit_unit != null ? String(p.lower_limit_unit) : null,
    untenBezug: p.lower_limit_alt_ref != null ? String(p.lower_limit_alt_ref) : null,
    obenWert: zahlOderNull(p.upper_limit_altitude),
    obenEinheit: p.upper_limit_unit != null ? String(p.upper_limit_unit) : null,
    obenBezug: p.upper_limit_alt_ref != null ? String(p.upper_limit_alt_ref) : null,
    rechtsgrundlage: p.legal_ref != null ? String(p.legal_ref).trim() : null,
  };
}

/** Höhenangabe in Meter, egal ob sie in Fuß oder Metern kommt. */
export function hoeheInMeter(wert: number | null, einheit: string | null): number | null {
  if (wert === null) return null;
  const e = (einheit || '').toLowerCase();
  if (e === 'ft' || e === 'feet') return Math.round(wert * 0.3048);
  return Math.round(wert);
}

/** "0 m AGL – 2500 ft MSL" für die Anzeige. */
export function formatGrenzen(z: Zone): string {
  const teil = (w: number | null, e: string | null, b: string | null) =>
    w === null ? null : `${w} ${e ?? 'm'}${b ? ' ' + b : ''}`;
  const unten = teil(z.untenWert, z.untenEinheit, z.untenBezug);
  const oben = teil(z.obenWert, z.obenEinheit, z.obenBezug);
  if (!unten && !oben) return 'keine Höhenangabe';
  return `${unten ?? '—'} – ${oben ?? 'unbegrenzt'}`;
}

/** Liegt die geplante Flughöhe (m über Grund) im vertikalen Bereich der Zone?
 *  Ohne Angabe wird konservativ „betroffen“ angenommen. */
export function betrifftHoehe(z: Zone, planHoeheM: number): boolean {
  const unten = hoeheInMeter(z.untenWert, z.untenEinheit);
  const oben = hoeheInMeter(z.obenWert, z.obenEinheit);
  if (unten === null && oben === null) return true;
  if (unten !== null && planHoeheM < unten) return false;
  if (oben !== null && planHoeheM > oben) return false;
  return true;
}

export interface ZonenUrteil {
  stufe: 'frei' | 'hinweis' | 'kritisch';
  text: string;
}

export function bewerteZonen(zonen: Zone[]): ZonenUrteil {
  if (zonen.length === 0) {
    return { stufe: 'frei', text: 'Keine eingetragene Geo-Zone am Standort gefunden.' };
  }
  const kritisch = zonen.filter(z => z.stufe === 'kritisch');
  if (kritisch.length > 0) {
    return {
      stufe: 'kritisch',
      text: `${kritisch.length} Zone(n) mit Flugverbot oder Freigabepflicht — vor dem Start klären.`,
    };
  }
  return {
    stufe: 'hinweis',
    text: `${zonen.length} Zone(n) mit Auflagen — Bedingungen beachten.`,
  };
}

/** Zonen am Punkt abfragen. Pro Layer eine eigene Anfrage (WFS-JOIN-Eigenheit),
 *  alle parallel; einzelne Ausfälle kippen das Gesamtergebnis nicht. */
export async function holeZonen(lat: number, lon: number, radiusM = 500): Promise<Zone[]> {
  const bbox = bboxUmPunkt(lat, lon, radiusM);
  const anfragen = ZONEN_LAYER.map(async def => {
    const url =
      `${BASIS}?service=WFS&version=2.0.0&request=GetFeature` +
      `&typeNames=dipul:${def.layer}&outputFormat=application/json&count=5` +
      `&bbox=${bbox},urn:ogc:def:crs:OGC::CRS84`;
    const antwort = await fetch(url);
    if (!antwort.ok) throw new Error(`${def.layer}: HTTP ${antwort.status}`);
    const daten = await antwort.json();
    const features = Array.isArray(daten?.features) ? daten.features : [];
    return features.map((f: any) => zuZone(f, def));
  });

  const ergebnisse = await Promise.allSettled(anfragen);
  return ergebnisse
    .filter((e): e is PromiseFulfilledResult<Zone[]> => e.status === 'fulfilled')
    .flatMap(e => e.value);
}
