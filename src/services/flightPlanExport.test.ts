import { describe, it, expect } from 'vitest';
import { alsGpx, alsKml, dateiname, xmlEscape } from './flightPlanExport';
import type { FlightPlan } from './db';

const plan: FlightPlan = {
  id: 'p1',
  name: 'Testroute Nord',
  wegpunkte: [
    { lat: 52.5200, lon: 13.4050 },
    { lat: 52.5250, lon: 13.4100, alt: 80 },
    { lat: 52.5300, lon: 13.4150 },
  ],
  createdAt: Date.UTC(2026, 0, 15, 10, 0, 0),
};

describe('xmlEscape', () => {
  it('entschärft alle fünf XML-Sonderzeichen', () => {
    expect(xmlEscape(`<a & "b" 'c'>`)).toBe('&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;');
  });
});

describe('alsGpx', () => {
  const gpx = alsGpx(plan);

  it('beginnt mit XML-Deklaration und gpx-Wurzel', () => {
    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx).toContain('<gpx version="1.1"');
  });

  it('enthält je Wegpunkt einen <wpt> und einen <rtept>', () => {
    expect(gpx.match(/<wpt /g)).toHaveLength(3);
    expect(gpx.match(/<rtept /g)).toHaveLength(3);
  });

  it('schreibt lat und lon in die richtigen Attribute', () => {
    expect(gpx).toContain('<wpt lat="52.520000" lon="13.405000">');
  });

  it('übernimmt die Höhe nur wenn gesetzt', () => {
    expect(gpx.match(/<ele>/g)).toHaveLength(1);
    expect(gpx).toContain('<ele>80</ele>');
  });

  it('öffnende und schließende Tags sind ausgeglichen', () => {
    const auf = (gpx.match(/<(?!\?|\/)[a-z]+/g) ?? []).length;
    const zu = (gpx.match(/<\/[a-z]+>/g) ?? []).length;
    // <wpt …> und <rtept …> haben eigene Schluss-Tags, self-closing gibt es keine
    expect(auf).toBe(zu);
  });
});

describe('alsKml', () => {
  const kml = alsKml(plan);

  it('schreibt Koordinaten als lon,lat — nicht lat,lon', () => {
    // Erster Punkt: lon 13.405 muss VOR lat 52.52 stehen.
    expect(kml).toContain('13.405000,52.520000');
    expect(kml).not.toContain('52.520000,13.405000');
  });

  it('enthält eine LineString-Route mit allen Punkten', () => {
    const linie = kml.match(/<coordinates>([^<]*)<\/coordinates>/)?.[1] ?? '';
    expect(linie.trim().split(/\s+/)).toHaveLength(3);
  });

  it('legt je Wegpunkt ein Placemark an, plus eines für die Route', () => {
    expect(kml.match(/<Placemark>/g)).toHaveLength(4);
  });

  it('hängt die Höhe an, wenn vorhanden', () => {
    expect(kml).toContain('13.410000,52.525000,80');
  });
});

describe('Sonderzeichen im Plannamen', () => {
  const boese: FlightPlan = { ...plan, name: 'Nord & Süd <Test>' };

  it('zerlegen die GPX-Datei nicht', () => {
    expect(alsGpx(boese)).toContain('Nord &amp; Süd &lt;Test&gt;');
    expect(alsGpx(boese)).not.toContain('<Test>');
  });

  it('zerlegen die KML-Datei nicht', () => {
    expect(alsKml(boese)).not.toContain('<Test>');
  });
});

describe('dateiname', () => {
  it('macht aus dem Plannamen einen sicheren Dateinamen', () => {
    expect(dateiname(plan, 'gpx')).toBe('testroute_nord.gpx');
  });
  it('fällt bei namenlosen Plänen auf flugplan zurück', () => {
    expect(dateiname({ ...plan, name: '###' }, 'kml')).toBe('flugplan.kml');
  });
});

describe('leerer Plan', () => {
  const leer: FlightPlan = { ...plan, wegpunkte: [] };
  it('erzeugt trotzdem gültiges XML statt zu werfen', () => {
    expect(() => alsGpx(leer)).not.toThrow();
    expect(alsKml(leer)).toContain('<coordinates></coordinates>');
  });
});
