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
