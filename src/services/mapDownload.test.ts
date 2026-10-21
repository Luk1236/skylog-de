import { describe, it, expect, vi } from 'vitest';
import { berechneFortschritt, gesamtAusContentRange, ladeRegion } from './mapDownload';
import type { KartenRegion } from './mapRegions';

const gespeichert = vi.hoisted(() => ({ karten: [] as { groesse: number; blob: Blob }[] }));
vi.mock('./db', () => ({ dbService: { saveMapRegion: async (k: { groesse: number; blob: Blob }) => { gespeichert.karten.push(k); } } }));

const region = { code: 'de-test', name: 'Test', datei: 'de-test.pmtiles', maxZoom: 13, bbox: { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 } } as KartenRegion;

/** Nachgebauter Server: beantwortet Range-Anfragen mit 206 wie GitHub hinter dem Proxy. */
function server(datei: Uint8Array, mitRange = true) {
  const anfragen: string[] = [];
  const hole = (async (_url: string, init?: RequestInit) => {
    const range = new Headers(init?.headers).get('range') ?? '';
    anfragen.push(range);
    const m = range.match(/bytes=(\d+)-(\d+)/);
    if (!mitRange || !m) return new Response(datei.slice(), { status: 200 });
    const von = Number(m[1]);
    const bis = Math.min(Number(m[2]), datei.length - 1);
    return new Response(datei.slice(von, bis + 1), { status: 206, headers: { 'content-range': `bytes ${von}-${bis}/${datei.length}` } });
  }) as typeof fetch;
  return { hole, anfragen };
}

describe('ladeRegion im Browser (Teilstücke für die 4,5-MB-Grenze von Vercel)', () => {
  const datei = Uint8Array.from({ length: 2500 }, (_, i) => i % 251);

  it('lädt in Stücken, setzt sie richtig zusammen und meldet den Fortschritt', async () => {
    const { hole, anfragen } = server(datei);
    const fortschritt: (number | null)[] = [];
    const karte = await ladeRegion(region, false, f => fortschritt.push(f.prozent), hole, 1000);
    expect(anfragen).toEqual(['bytes=0-999', 'bytes=1000-1999', 'bytes=2000-2499']);
    expect(new Uint8Array(await karte.blob.arrayBuffer())).toEqual(datei);
    expect(karte.groesse).toBe(2500);
    expect(fortschritt).toEqual([40, 80, 100]);
    expect(gespeichert.karten.at(-1)?.groesse).toBe(2500);
  });

  it('nimmt die ganze Datei, wenn der Server kein Range kann', async () => {
    const { hole, anfragen } = server(datei, false);
    const karte = await ladeRegion(region, false, undefined, hole, 1000);
    expect(anfragen).toHaveLength(1);
    expect(karte.groesse).toBe(2500);
  });

  it('meldet einen Fehler, statt eine halbe Karte zu speichern', async () => {
    const hole = (async () => new Response('', { status: 413 })) as unknown as typeof fetch;
    await expect(ladeRegion(region, false, undefined, hole, 1000)).rejects.toThrow(/HTTP 413/);
  });

  it('liest die Gesamtgröße aus Content-Range', () => {
    expect(gesamtAusContentRange('bytes 0-4194303/157286400')).toBe(157286400);
    expect(gesamtAusContentRange('bytes 0-99/*')).toBeNull();
    expect(gesamtAusContentRange(null)).toBeNull();
  });
});

describe('berechneFortschritt', () => {
  it('rechnet den Anteil in Prozent', () => {
    expect(berechneFortschritt(50, 200).prozent).toBe(25);
    expect(berechneFortschritt(200, 200).prozent).toBe(100);
  });

  it('reicht die Rohwerte durch', () => {
    const f = berechneFortschritt(120, 480);
    expect(f.geladen).toBe(120);
    expect(f.gesamt).toBe(480);
  });

  // Ohne content-length darf kein Prozentwert erfunden werden — die Anzeige
  // soll dann einen unbestimmten Balken zeigen.
  it('liefert null, wenn die Gesamtgröße unbekannt ist', () => {
    expect(berechneFortschritt(1000, 0).prozent).toBeNull();
    expect(berechneFortschritt(1000, Number.NaN).prozent).toBeNull();
  });

  // Bei Umleitungen kann content-length kleiner sein als die gelesenen Bytes.
  it('deckelt bei 100 statt über den Balken hinauszulaufen', () => {
    expect(berechneFortschritt(300, 200).prozent).toBe(100);
  });

  it('startet bei 0', () => {
    expect(berechneFortschritt(0, 500).prozent).toBe(0);
  });
});
