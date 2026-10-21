import { describe, it, expect } from 'vitest';
import { fluegeImZeitraum, betriebsnachweis, pdfTabellenzeilen, baueCsv, baueKml, csvZelle } from './reportExport';
import type { Flight, Drone, TrackPoint } from './db';

const drohne: Drone = { id: 'd1', model: 'Mini 4 Pro', weight: 249, uasClass: 'C0', eId: 'x', createdAt: 0 };

function flug(over: Partial<Flight>): Flight {
  return {
    id: Math.random().toString(36).slice(2), droneId: 'd1', date: '2026-05-01',
    startTime: '10:00', endTime: '10:20', duration: 20, location: 'Feld',
    locationName: 'Feld', coordinates: [48.1, 7.9], notes: '', createdAt: 0, ...over,
  };
}

// Track, der die 120-m-Warnung auslöst.
const hochTrack: TrackPoint[] = [
  { t: 0, lat: 48.1, lon: 7.9, alt: 10 },
  { t: 5, lat: 48.1, lon: 7.9, alt: 130 },
];

describe('fluegeImZeitraum', () => {
  it('filtert nach Jahr und lässt "alle" durch', () => {
    const f = [flug({ date: '2025-03-03' }), flug({ date: '2026-07-07' })];
    expect(fluegeImZeitraum(f, '2026')).toHaveLength(1);
    expect(fluegeImZeitraum(f, 'alle')).toHaveLength(2);
  });
});

describe('betriebsnachweis', () => {
  it('summiert Flüge, Flugzeit, Tage, Vorfälle, Drohnen und Auffälligkeiten', () => {
    const b = betriebsnachweis([
      flug({ date: '2026-05-01', duration: 90, droneId: 'd1' }),
      flug({ date: '2026-05-01', duration: 40, droneId: 'd2', incidents: 'Notlandung' }),
      flug({ date: '2026-05-02', duration: 20, droneId: 'd1', track: hochTrack }),
    ]);
    expect(b.anzahl).toBe(3);
    expect(b.flugzeitMin).toBe(150);
    expect(b.stunden).toBe(2);
    expect(b.restMin).toBe(30);
    expect(b.aktiveTage).toBe(2);
    expect(b.vorfaelle).toBe(1);
    expect(b.genutzteDrohnen).toBe(2);
    expect(b.fluegeMitAuffaelligkeiten).toBe(1);
  });
});

describe('pdfTabellenzeilen', () => {
  it('erzeugt eine Zeile je Flug und hängt Warnungen an die Bemerkungen', () => {
    const rows = pdfTabellenzeilen([flug({ track: hochTrack, notes: 'Testflug' })], [drohne]);
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe('Mini 4 Pro');
    expect(rows[0][6]).toContain('Testflug');
    expect(rows[0][6]).toContain('⚠');
    expect(rows[0][6]).toMatch(/120/);
  });
});

/** Kleiner RFC-4180-Leser (Semikolon, CRLF) - prüft, was Excel aus der Datei macht. */
function leseCsv(text: string): string[][] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = '';
  let inAnfuehrung = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inAnfuehrung) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inAnfuehrung = false;
      else feld += c;
    } else if (c === '"') inAnfuehrung = true;
    else if (c === ';') { zeile.push(feld); feld = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ''; i++; }
    else feld += c;
  }
  zeile.push(feld);
  zeilen.push(zeile);
  return zeilen;
}

describe('baueCsv', () => {
  const csv = baueCsv([flug({ notes: 'ruhig, windig', pilotName: 'Lukas' })], [drohne]);
  it('beginnt mit BOM und der Kopfzeile, Semikolon als Trenner', () => {
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv.split('\r\n')[0]).toContain('Datum;Drohne;Pilot');
  });

  it('hält Ortsnamen mit Komma, mehrzeilige Notizen und Anführungszeichen in ihrer Spalte', () => {
    const text = baueCsv([flug({
      locationName: 'Herrngarten, Darmstadt', notes: 'Erster Flug\nzweite Zeile; mit "Zitat"', incidents: 'Akku warm',
      weather: { temp: 12.5, windSpeed: 18, condition: 'klar' } as Flight['weather'],
    })], [drohne]).slice(1);
    const [kopf, zeile, ...rest] = leseCsv(text);
    expect(rest).toEqual([]);
    expect(zeile).toHaveLength(kopf.length);
    const spalte = (name: string) => zeile[kopf.indexOf(name)];
    expect(spalte('Ort')).toBe('Herrngarten, Darmstadt');
    expect(spalte('Notizen')).toBe('Erster Flug\nzweite Zeile; mit "Zitat"');
    expect(spalte('Temperatur (°C)')).toBe('12,5');
    expect(spalte('Wind (km/h)')).toBe('18');
    expect(spalte('Vorkommnisse')).toBe('Akku warm');
  });

  it('entschärft Formeln, lässt aber Zahlen in Ruhe', () => {
    expect(csvZelle('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvZelle('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvZelle(-3)).toBe('-3');
    expect(csvZelle(undefined)).toBe('');
  });
});

describe('baueKml', () => {
  it('schreibt Placemarks in lon,lat-Reihenfolge und nur mit Koordinaten', () => {
    const kml = baueKml([flug({ coordinates: [48.1, 7.9] }), flug({ coordinates: undefined })]);
    expect((kml.match(/<Placemark>/g) || [])).toHaveLength(1);
    expect(kml).toContain('<coordinates>7.9,48.1,0</coordinates>');
  });
});
