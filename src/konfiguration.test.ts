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

  it('nimmt die App-Daten von der Google-Kontosicherung aus, erlaubt aber den Gerätewechsel (N16)', () => {
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
    const regeln = lies('../android/app/src/main/res/xml/data_extraction_rules.xml');
    const alt = lies('../android/app/src/main/res/xml/backup_rules.xml');
    for (const datei of [regeln, alt]) {
      expect(datei).toMatch(/<exclude domain="root" path="\."/);
      expect(datei).toMatch(/<exclude domain="database" path="\."/);
    }
    // Kein device-transfer-Ausschluss: Der lokale Gerätewechsel bleibt erlaubt.
    expect(regeln).not.toContain('<device-transfer');
    expect(lies('../public/datenschutz.html')).toContain('nicht in die Google-Kontosicherung');
    expect(lies('../public/privacy.html')).toContain('does not include the app data in your Google account backup');
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
  const englisch = lies('../public/privacy.html');

  it('enthält die Pflichtangaben nach Art. 13 DSGVO', () => {
    for (const abschnitt of ['Verantwortlicher', 'Rechtsgrundlagen', 'Übermittlung in Drittländer', 'Speicherdauer', 'Deine Rechte']) {
      expect(text).toMatch(new RegExp(`<h2>\\d+\\. ${abschnitt}`));
    }
    expect(text).toContain('Art. 77');
    expect(text).toContain('Art. 6 Abs. 1 lit. a');
  });

  it('duzt wie die App (Software-Check R3-10)', () => {
    expect(text).not.toMatch(/\b(Sie|Ihr|Ihre|Ihren|Ihrem|Ihres|Ihnen)\b/);
  });

  it('gibt es auch auf Englisch, mit denselben Abschnitten', () => {
    expect(englisch).toContain('<html lang="en">');
    for (const abschnitt of ['Controller', 'Legal bases', 'Transfers to third countries', 'Retention', 'Your rights']) {
      expect(englisch).toMatch(new RegExp(`<h2>\\d+\\. ${abschnitt}`));
    }
    const abschnitte = (html: string) => (html.match(/<h2>/g) ?? []).length;
    expect(abschnitte(englisch)).toBe(abschnitte(text));
    expect(englisch).toContain('href="datenschutz.html"');
    expect(text).toContain('href="privacy.html"');
  });

  it('behauptet nicht mehr, es gingen keine personenbezogenen Daten nach außen', () => {
    expect(text).not.toMatch(/keine personenbezogenen Daten auf externe Server/);
  });

  it('nennt in beiden Sprachen jeden Kachel-Server, den die Karten laden', () => {
    const hosts = new Set([...lies('./lib/kacheln.ts').matchAll(/https:\/\/(?:\{s\}\.)?(tile\.openstreetmap\.[a-z]+)/g)].map(m => m[1]));
    expect(hosts.size).toBe(2);
    for (const host of hosts) {
      expect(text).toContain(host);
      expect(englisch).toContain(host);
    }
  });
});

describe('Kartenkacheln (OSM-Regeln)', () => {
  it('alle Karten nehmen Adresse und Namensnennung aus src/lib/kacheln.ts', () => {
    for (const n of ['DroneMap', 'FlightPlannerDialog', 'FlightTrackDialog']) {
      const quelle = lies(`./components/${n}.tsx`);
      expect(quelle).not.toMatch(/tile\.openstreetmap/);
      expect(quelle).toMatch(/<TileLayer[^>]*attribution=\{(HOT|OSM)_NAMENSNENNUNG\}/);
      expect(quelle).toMatch(/<TileLayer[^>]*className=\{GRUNDKARTE_KLASSE\}/);
    }
  });

  it('dunkelt im Dunkelmodus nur die Grundkarte ab (Software-Check R3-11)', async () => {
    const { GRUNDKARTE_KLASSE } = await import('./lib/kacheln');
    expect(lies('./index.css')).toMatch(new RegExp(`:root\\[data-theme="dark"\\] \\.${GRUNDKARTE_KLASSE} \\{\\s*filter:`));
    // Die Offline-Karte hat einen echten dunklen Stil und braucht den Filter nicht.
    expect(lies('./components/OfflineBasemap.tsx')).toContain("flavor: dunkel ? 'dark' : 'light'");
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
