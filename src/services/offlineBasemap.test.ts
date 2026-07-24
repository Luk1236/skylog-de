import { describe, it, expect } from 'vitest';
import { pruefeOfflineKarte, OFFLINE_KARTE_URL } from './offlineBasemap';

function antwort(opt: { ok?: boolean; typ?: string; laenge?: string }): Response {
  return {
    ok: opt.ok ?? true,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? (opt.typ ?? 'application/octet-stream')
        : name.toLowerCase() === 'content-length' ? (opt.laenge ?? '5000000')
        : null,
    },
  } as unknown as Response;
}

describe('pruefeOfflineKarte', () => {
  it('erkennt eine vorhandene Karte', async () => {
    const da = await pruefeOfflineKarte(OFFLINE_KARTE_URL, async () => antwort({}));
    expect(da).toBe(true);
  });

  it('verneint bei Fehlerstatus', async () => {
    const da = await pruefeOfflineKarte(OFFLINE_KARTE_URL, async () => antwort({ ok: false }));
    expect(da).toBe(false);
  });

  // Der eigentliche Grund für die Typ-Prüfung: Vite liefert für unbekannte
  // Pfade die index.html mit Status 200 aus. Ohne diese Prüfung hielte die App
  // eine HTML-Seite für eine Karte.
  it('fällt nicht auf eine als HTML ausgelieferte index.html herein', async () => {
    const da = await pruefeOfflineKarte(OFFLINE_KARTE_URL, async () =>
      antwort({ typ: 'text/html; charset=utf-8', laenge: '900000' })
    );
    expect(da).toBe(false);
  });

  it('verneint bei verdächtig kleiner Datei', async () => {
    const da = await pruefeOfflineKarte(OFFLINE_KARTE_URL, async () => antwort({ laenge: '2048' }));
    expect(da).toBe(false);
  });

  it('verneint statt zu werfen, wenn fetch scheitert (offline)', async () => {
    const da = await pruefeOfflineKarte(OFFLINE_KARTE_URL, async () => { throw new Error('offline'); });
    expect(da).toBe(false);
  });

  it('fragt genau die übergebene URL per HEAD ab', async () => {
    let gesehen = '';
    let methode = '';
    await pruefeOfflineKarte('/karten/test.pmtiles', async (url, init) => {
      gesehen = String(url);
      methode = String((init as RequestInit)?.method);
      return antwort({});
    });
    expect(gesehen).toBe('/karten/test.pmtiles');
    expect(methode).toBe('HEAD');
  });
});
