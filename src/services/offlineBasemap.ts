// Offline-Karte, Stufe 2: Verfügbarkeit der mitgelieferten PMTiles-Datei.
//
// Die Datei wird beim Bau erzeugt (scripts/karte-extrahieren.mjs) und liegt
// dann unter public/karten/region.pmtiles. Beim Entwickeln ist sie oft NICHT
// da — deshalb fragt die App vor dem Rendern nach und fällt sonst auf die
// bisherige Online-Karte zurück. Kein Abbruch, nur eine andere Ebene.
//
// fetch ist einspeisbar, damit die Logik ohne Netz testbar bleibt.

export const OFFLINE_KARTE_URL = '/karten/region.pmtiles';

type FetchArt = typeof fetch;

/** Liegt eine brauchbare Offline-Karte vor?
 *
 *  Geprüft wird per HEAD: Statuscode ok UND eine plausible Größe. Die
 *  Größenprüfung ist wichtig, weil ein Dev-Server auf unbekannte Pfade gern
 *  die index.html mit Status 200 ausliefert — ohne sie hielte die App eine
 *  HTML-Seite für eine Karte. */
export async function pruefeOfflineKarte(
  url: string = OFFLINE_KARTE_URL,
  hole: FetchArt = fetch
): Promise<boolean> {
  try {
    const antwort = await hole(url, { method: 'HEAD' });
    if (!antwort.ok) return false;

    const typ = antwort.headers.get('content-type') ?? '';
    if (typ.includes('text/html')) return false;

    const laenge = Number(antwort.headers.get('content-length') ?? '0');
    // Eine echte PMTiles-Datei ist mindestens einige hundert kB groß.
    return laenge > 100_000;
  } catch {
    // Offline, blockiert, Datei fehlt — in jedem Fall: keine Offline-Karte.
    return false;
  }
}
