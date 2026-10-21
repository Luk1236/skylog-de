// Konfigurations-Wächter: Einstellungen außerhalb des TypeScript-Codes, die
// schon einmal falsch waren und sich nicht per Typcheck prüfen lassen.
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { ASSET_CACHE, SICHERHEITS_HEADER } from '../api/_lib/sicherheitsHeader';

const lies = (pfad: string) => readFileSync(new URL(pfad, import.meta.url), 'utf8');

describe('Android-Manifest', () => {
  const manifest = lies('../android/app/src/main/AndroidManifest.xml');

  it('erlaubt die Standortabfrage (sonst gibt es in der APK kein GPS)', () => {
    expect(manifest).toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(manifest).toContain('android.permission.ACCESS_COARSE_LOCATION');
  });

  it('verlangt kein GPS als Pflicht-Hardware', () => {
    expect(manifest).toMatch(/android\.hardware\.location\.gps"\s+android:required="false"/);
  });
});

describe('index.html', () => {
  const html = lies('../index.html');

  it('sperrt das Zoomen nicht (Barrierefreiheit, WCAG 1.4.4)', () => {
    const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });

  it('nennt Deutsch als Seitensprache', () => {
    expect(html).toContain('<html lang="de">');
  });
});

describe('Datenschutzerklärung', () => {
  const text = lies('../public/datenschutz.html');

  it('enthält die Pflichtangaben nach Art. 13 DSGVO', () => {
    for (const abschnitt of ['Verantwortlicher', 'Rechtsgrundlagen', 'Übermittlung in Drittländer', 'Speicherdauer', 'Ihre Rechte']) {
      expect(text).toMatch(new RegExp(`<h2>\\d+\\. ${abschnitt}`));
    }
    expect(text).toContain('Art. 77');
    expect(text).toContain('Art. 6 Abs. 1 lit. a');
  });

  it('behauptet nicht mehr, es gingen keine personenbezogenen Daten nach außen', () => {
    expect(text).not.toMatch(/keine personenbezogenen Daten auf externe Server/);
  });

  it('nennt jeden Kachel-Server, den die Karten laden', () => {
    const hosts = new Set([...lies('./lib/kacheln.ts').matchAll(/https:\/\/(?:\{s\}\.)?(tile\.openstreetmap\.[a-z]+)/g)].map(m => m[1]));
    expect(hosts.size).toBe(2);
    for (const host of hosts) expect(text).toContain(host);
  });
});

describe('Kartenkacheln (OSM-Regeln)', () => {
  it('alle Karten nehmen Adresse und Namensnennung aus src/lib/kacheln.ts', () => {
    for (const n of ['DroneMap', 'FlightPlannerDialog', 'FlightTrackDialog']) {
      const quelle = lies(`./components/${n}.tsx`);
      expect(quelle).not.toMatch(/tile\.openstreetmap/);
      expect(quelle).toMatch(/<TileLayer[^>]*attribution=\{(HOT|OSM)_NAMENSNENNUNG\}/);
    }
  });

  it('die Android-App meldet sich mit derselben Kennung wie die nativen Abrufe', async () => {
    const { APP_KENNUNG } = await import('./lib/appInfo');
    expect(lies('../capacitor.config.ts')).toContain(`appendUserAgent: '${APP_KENNUNG}'`);
  });

  it('der Kachel-Cache im Service Worker trifft beide Kachel-Server', () => {
    const muster = lies('../vite.config.ts').match(/urlPattern: \/(\^https:[^\n]*tile[^\n]*)\/i,/)?.[1];
    expect(muster).toBeTruthy();
    const regel = new RegExp(muster!, 'i');
    expect(regel.test('https://b.tile.openstreetmap.fr/hot/12/2140/1400.png')).toBe(true);
    expect(regel.test('https://tile.openstreetmap.org/12/2140/1400.png')).toBe(true);
  });
});

describe('vercel.json', () => {
  const vercel = JSON.parse(lies('../vercel.json')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const fuer = (quelle: string) =>
    Object.fromEntries((vercel.headers.find(h => h.source === quelle)?.headers ?? []).map(h => [h.key, h.value]));

  it('setzt dieselben Sicherheits-Header wie server.ts', () => {
    expect(fuer('/(.*)')).toEqual(SICHERHEITS_HEADER);
  });

  it('lässt gehashte Assets lange im Cache', () => {
    expect(fuer('/assets/(.*)')['Cache-Control']).toBe(ASSET_CACHE);
  });

  it('erlaubt Skripte nur von der eigenen Seite', () => {
    expect(SICHERHEITS_HEADER['Content-Security-Policy']).toMatch(/script-src 'self'(;|$)/);
  });
});
