import { describe, it, expect } from 'vitest';
import {
  bboxUmPunkt, zuZone, hoeheInMeter, formatGrenzen, betrifftHoehe,
  bewerteZonen, ZONEN_LAYER, type Zone,
} from './airspaceZones';

const CTR = ZONEN_LAYER.find(l => l.layer === 'kontrollzonen')!;
const NSG = ZONEN_LAYER.find(l => l.layer === 'naturschutzgebiete')!;

function zone(over: Partial<Zone> = {}): Zone {
  return {
    layer: 'kontrollzonen', label: 'Kontrollzone (CTR)', stufe: 'kritisch',
    name: 'FRANKFURT (CTR)', typeCode: 'KONTROLLZONE',
    untenWert: 0, untenEinheit: 'm', untenBezug: 'AGL',
    obenWert: 2500, obenEinheit: 'ft', obenBezug: 'MSL',
    rechtsgrundlage: '§ 21h LuftVO', ...over,
  };
}

describe('bboxUmPunkt', () => {
  it('liefert vier Werte in CRS84-Reihenfolge (lon,lat,lon,lat)', () => {
    const [minLon, minLat, maxLon, maxLat] = bboxUmPunkt(50.045, 8.598, 500).split(',').map(Number);
    expect(minLon).toBeLessThan(8.598);
    expect(maxLon).toBeGreaterThan(8.598);
    expect(minLat).toBeLessThan(50.045);
    expect(maxLat).toBeGreaterThan(50.045);
  });

  it('wächst mit dem Radius', () => {
    const klein = bboxUmPunkt(50, 8, 100).split(',').map(Number);
    const gross = bboxUmPunkt(50, 8, 5000).split(',').map(Number);
    expect(gross[2] - gross[0]).toBeGreaterThan(klein[2] - klein[0]);
  });
});

describe('zuZone', () => {
  it('übernimmt Name, Typ, Grenzen und Rechtsgrundlage', () => {
    const z = zuZone({
      properties: {
        name: 'FRANKFURT (CTR)', type_code: 'KONTROLLZONE',
        lower_limit_altitude: 0, lower_limit_unit: 'm', lower_limit_alt_ref: 'AGL',
        upper_limit_altitude: 2500, upper_limit_unit: 'ft', upper_limit_alt_ref: 'MSL',
        legal_ref: ' § 21h, Abs. 3 (9.) LuftVO ',
      },
    }, CTR);
    expect(z.name).toBe('FRANKFURT (CTR)');
    expect(z.typeCode).toBe('KONTROLLZONE');
    expect(z.obenWert).toBe(2500);
    expect(z.obenEinheit).toBe('ft');
    expect(z.rechtsgrundlage).toBe('§ 21h, Abs. 3 (9.) LuftVO');
    expect(z.stufe).toBe('kritisch');
  });

  it('fällt auf das Layer-Label zurück, wenn kein Name kommt', () => {
    expect(zuZone({ properties: {} }, NSG).name).toBe('Naturschutzgebiet');
  });

  it('macht fehlende Höhen zu null statt NaN', () => {
    const z = zuZone({ properties: { name: 'X' } }, CTR);
    expect(z.untenWert).toBeNull();
    expect(z.obenWert).toBeNull();
  });
});

describe('hoeheInMeter', () => {
  it('rechnet Fuß in Meter', () => {
    expect(hoeheInMeter(2500, 'ft')).toBe(762);
  });
  it('lässt Meter unverändert', () => {
    expect(hoeheInMeter(120, 'm')).toBe(120);
  });
  it('gibt null bei fehlendem Wert', () => {
    expect(hoeheInMeter(null, 'ft')).toBeNull();
  });
});

describe('formatGrenzen', () => {
  it('zeigt beide Grenzen mit Einheit und Bezug', () => {
    expect(formatGrenzen(zone())).toBe('0 m AGL – 2500 ft MSL');
  });
  it('nennt fehlende Obergrenze unbegrenzt', () => {
    expect(formatGrenzen(zone({ obenWert: null }))).toContain('unbegrenzt');
  });
  it('sagt es, wenn gar nichts angegeben ist', () => {
    expect(formatGrenzen(zone({ untenWert: null, obenWert: null }))).toBe('keine Höhenangabe');
  });
});

describe('betrifftHoehe', () => {
  it('trifft zu, wenn die Flughöhe im Bereich liegt', () => {
    expect(betrifftHoehe(zone(), 100)).toBe(true);   // 0 m AGL bis 762 m
  });
  it('trifft nicht zu, wenn die Zone erst höher beginnt', () => {
    expect(betrifftHoehe(zone({ untenWert: 300, untenEinheit: 'm' }), 100)).toBe(false);
  });
  it('trifft nicht zu, wenn die Zone unter der Flughöhe endet', () => {
    expect(betrifftHoehe(zone({ obenWert: 50, obenEinheit: 'm' }), 100)).toBe(false);
  });
  it('nimmt ohne Höhenangabe konservativ betroffen an', () => {
    expect(betrifftHoehe(zone({ untenWert: null, obenWert: null }), 100)).toBe(true);
  });
});

describe('bewerteZonen', () => {
  it('meldet frei ohne Treffer', () => {
    expect(bewerteZonen([]).stufe).toBe('frei');
  });
  it('meldet kritisch, sobald eine kritische Zone dabei ist', () => {
    const u = bewerteZonen([zone({ stufe: 'hinweis' }), zone({ stufe: 'kritisch' })]);
    expect(u.stufe).toBe('kritisch');
    expect(u.text).toMatch(/Flugverbot|Freigabe/);
  });
  it('meldet nur Hinweis bei reinen Auflagen-Zonen', () => {
    expect(bewerteZonen([zone({ stufe: 'hinweis' })]).stufe).toBe('hinweis');
  });
});
