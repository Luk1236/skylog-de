// Aufbereitung der Logbuch-Exporte (CSV, KML, PDF-Tabellendaten und die
// Betriebsnachweis-Summen). Reine Funktionen ohne DOM/Bibliotheks-Seiteneffekte
// — der Download (Blob/jsPDF) bleibt dünn in der UI, damit diese Logik testbar
// ist.

import type { Flight, Drone } from './db';
import { analysiereTrack } from './flightTrack';

/** Flüge auf ein Jahr eingrenzen. 'alle' lässt alles durch. */
export function fluegeImZeitraum(flights: Flight[], jahr: string): Flight[] {
  return jahr === 'alle' ? flights : flights.filter(f => (f.date || '').startsWith(jahr));
}

export interface Betriebsnachweis {
  anzahl: number;
  flugzeitMin: number;
  stunden: number;
  restMin: number;
  aktiveTage: number;
  vorfaelle: number;
  genutzteDrohnen: number;
  fluegeMitAuffaelligkeiten: number;
}

/** Summen für den Betriebsnachweis über eine Flugmenge. */
export function betriebsnachweis(fluege: Flight[]): Betriebsnachweis {
  const flugzeitMin = fluege.reduce((s, f) => s + (f.duration || 0), 0);
  return {
    anzahl: fluege.length,
    flugzeitMin,
    stunden: Math.floor(flugzeitMin / 60),
    restMin: flugzeitMin % 60,
    aktiveTage: new Set(fluege.map(f => f.date)).size,
    vorfaelle: fluege.filter(f => f.incidents && f.incidents.trim()).length,
    genutzteDrohnen: new Set(fluege.map(f => f.droneId)).size,
    fluegeMitAuffaelligkeiten: fluege.filter(f => f.track && analysiereTrack(f.track).length > 0).length,
  };
}

/** Tabellenzeilen für das PDF (Datum, Drohne, Zeitraum, Dauer, Ort, Zweck,
 *  Bemerkungen inkl. Vorfall- und Track-Warnungstext). */
export function pdfTabellenzeilen(fluege: Flight[], drones: Drone[]): string[][] {
  return fluege.map(f => {
    const drone = drones.find(d => d.id === f.droneId);
    const warns = f.track ? analysiereTrack(f.track) : [];
    const warnText = warns.length > 0 ? `\n⚠ ${warns.map(w => w.text).join(' ')}` : '';
    return [
      f.date,
      drone?.model || 'Unbekannt',
      `${f.startTime} - ${f.endTime}`,
      `${f.duration} Min`,
      f.locationName || '',
      f.purpose || 'Hobby',
      `${f.notes || ''}${f.incidents ? `\nVORFALL: ${f.incidents}` : ''}${warnText}`,
    ];
  });
}

/** Vollständiger CSV-Export (mit BOM, damit Excel die Umlaute richtig liest). */
export function baueCsv(flights: Flight[], drones: Drone[], profilName?: string): string {
  const headers = ['Datum', 'Drohne', 'Pilot', 'Start', 'Ende', 'Dauer (Min)', 'Ort', 'Zweck', 'Wetter', 'Notizen', 'Vorkommnisse'];
  const rows = flights.map(f => {
    const drone = drones.find(d => d.id === f.droneId);
    return [
      f.date,
      drone?.model || 'Unbekannt',
      f.pilotName || profilName || 'Hauptpilot',
      f.startTime,
      f.endTime,
      f.duration,
      f.locationName,
      f.purpose || 'Hobby',
      f.weather ? `${f.weather.temp}°C, ${f.weather.windSpeed}km/h` : '',
      (f.notes || '').replace(/,/g, ';'),
      f.incidents?.replace(/,/g, ';') || '',
    ].join(',');
  });
  return '﻿' + [headers.join(','), ...rows].join('\n');
}

/** KML der Flugorte für Google Earth. Nur Flüge mit Koordinaten. */
export function baueKml(flights: Flight[]): string {
  const placemarks = flights
    .filter(f => f.coordinates)
    .map(f => `  <Placemark>
    <name>${f.locationName || 'Flug'}</name>
    <description>${f.date} · ${f.duration} min · ${f.purpose || 'Hobby'}</description>
    <Point><coordinates>${f.coordinates![1]},${f.coordinates![0]},0</coordinates></Point>
  </Placemark>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n  <name>SkyLog DE Fluggebiete</name>\n${placemarks}\n</Document>\n</kml>`;
}
