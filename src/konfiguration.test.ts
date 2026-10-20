// Konfigurations-Wächter: Einstellungen außerhalb des TypeScript-Codes, die
// schon einmal falsch waren und sich nicht per Typcheck prüfen lassen.
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

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
