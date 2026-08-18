// Flugpläne in Standardformate exportieren.
//
// GPX und KML sind offene Standards für Karten-Apps und Google Earth.
// Zusätzlich gibt es einen Litchi-Missions-CSV-Export: Litchi (und darüber
// DJI-Drohnen) kann diese Datei importieren und die Mission tatsächlich
// abfliegen — ohne dass SkyLog selbst das native SDK braucht. Das Fliegen
// übernimmt die Litchi-/DJI-App; SkyLog plant nur.
//
// Reine Zeichenketten-Erzeugung, damit sie testbar bleibt.

import type { FlightPlan, Wegpunkt, WegpunktAktion } from './db';

/** Standardhöhe (m über Start), wenn ein Wegpunkt keine eigene hat. */
export const STANDARD_HOEHE_M = 30;

/** XML-Sonderzeichen entschärfen, damit Plannamen die Datei nicht zerlegen. */
export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function koordinate(n: number): string {
  return n.toFixed(6);
}

/** GPX 1.1: Wegpunkte plus Route. Von Garmin, Locus, OsmAnd u.v.m. lesbar. */
export function alsGpx(plan: FlightPlan): string {
  const name = xmlEscape(plan.name || 'Flugplan');
  const wpt = plan.wegpunkte
    .map((w, i) => {
      const hoehe = typeof w.alt === 'number' ? `\n    <ele>${w.alt}</ele>` : '';
      return `  <wpt lat="${koordinate(w.lat)}" lon="${koordinate(w.lon)}">${hoehe}\n    <name>WP${i + 1}</name>\n  </wpt>`;
    })
    .join('\n');
  const rtept = plan.wegpunkte
    .map((w, i) => `    <rtept lat="${koordinate(w.lat)}" lon="${koordinate(w.lon)}"><name>WP${i + 1}</name></rtept>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SkyLog DE" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${new Date(plan.createdAt).toISOString()}</time>
  </metadata>
${wpt}
  <rte>
    <name>${name}</name>
${rtept}
  </rte>
</gpx>`;
}

/** KML 2.2: Linie plus nummerierte Punkte. Öffnet in Google Earth. */
export function alsKml(plan: FlightPlan): string {
  const name = xmlEscape(plan.name || 'Flugplan');
  // KML erwartet lon,lat[,alt] — nicht lat,lon.
  const linie = plan.wegpunkte
    .map((w: Wegpunkt) => `${koordinate(w.lon)},${koordinate(w.lat)}${typeof w.alt === 'number' ? ',' + w.alt : ''}`)
    .join(' ');
  const punkte = plan.wegpunkte
    .map((w, i) => `    <Placemark>
      <name>WP${i + 1}</name>
      <Point><coordinates>${koordinate(w.lon)},${koordinate(w.lat)}</coordinates></Point>
    </Placemark>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <Placemark>
      <name>${name} — Route</name>
      <LineString><tessellate>1</tessellate><coordinates>${linie}</coordinates></LineString>
    </Placemark>
${punkte}
  </Document>
</kml>`;
}

// ---------------------------------------------------------------------------
// Litchi-Missions-CSV (fliegbar über Litchi / DJI)
// ---------------------------------------------------------------------------

/** Unsere Aktion → Litchi actiontype + actionparam.
 *  Codes laut Litchi-CSV-Format: -1 keine, 0 Warten (ms), 1 Foto,
 *  2 Aufnahme starten, 3 Aufnahme stoppen. */
function litchiAktion(w: Wegpunkt): { typ: number; param: number } {
  const a: WegpunktAktion | undefined = w.aktion;
  if (a === 'hover') return { typ: 0, param: Math.max(0, Math.round((w.hoverSek ?? 2) * 1000)) };
  if (a === 'foto') return { typ: 1, param: 0 };
  if (a === 'video-start') return { typ: 2, param: 0 };
  if (a === 'video-stop') return { typ: 3, param: 0 };
  return { typ: -1, param: 0 };
}

/** Missions-CSV im Litchi-Format. Spaltenreihenfolge exakt wie von Litchi
 *  erwartet. Höhe ist „über Start" (altitudemode 0), Tempo in m/s
 *  (0 = globales Tempo aus der Litchi-App). */
export function alsLitchiCsv(plan: FlightPlan): string {
  const kopf = [
    'latitude', 'longitude', 'altitude(m)', 'heading(deg)', 'curvesize(m)',
    'rotationdir', 'gimbalmode', 'gimbalpitchangle',
    'actiontype1', 'actionparam1',
    'altitudemode', 'speed(m/s)',
    'poi_latitude', 'poi_longitude', 'poi_altitude(m)', 'poi_altitudemode',
    'photo_timeinterval', 'photo_distinterval',
  ];

  const zeilen = plan.wegpunkte.map(w => {
    const hoehe = typeof w.alt === 'number' ? w.alt : STANDARD_HOEHE_M;
    const speedMs = w.speed && w.speed > 0 ? Math.round((w.speed / 3.6) * 10) / 10 : 0;
    const { typ, param } = litchiAktion(w);
    return [
      w.lat.toFixed(6), w.lon.toFixed(6), hoehe, 0, 0.2,
      0, 0, 0,
      typ, param,
      0, speedMs,       // altitudemode 0 = über Start
      0, 0, 0, 0,       // kein POI
      -1, -1,           // keine Fotointervalle
    ].join(',');
  });

  return [kopf.join(','), ...zeilen].join('\n');
}

/** Dateiname ohne Sonderzeichen, mit passender Endung. */
export function dateiname(plan: FlightPlan, endung: 'gpx' | 'kml' | 'csv'): string {
  const basis = (plan.name || 'flugplan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'flugplan';
  return `${basis}.${endung}`;
}
