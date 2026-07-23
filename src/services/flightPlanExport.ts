// Flugpläne in Standardformate exportieren.
//
// Warum kein DJI-Format: Ein direkter Upload zur Drohne bräuchte DJIs
// Waypoint-Format und das native SDK. GPX und KML sind dagegen offene,
// dokumentierte Standards, die Karten- und Flug-Apps sowie Google Earth
// lesen — das ist der Weg, der ohne SDK tatsächlich funktioniert.
//
// Reine Zeichenketten-Erzeugung, damit sie testbar bleibt.

import type { FlightPlan, Wegpunkt } from './db';

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

/** Dateiname ohne Sonderzeichen, mit passender Endung. */
export function dateiname(plan: FlightPlan, endung: 'gpx' | 'kml'): string {
  const basis = (plan.name || 'flugplan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'flugplan';
  return `${basis}.${endung}`;
}
