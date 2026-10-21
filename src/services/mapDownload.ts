// Herunterladen und Bereitstellen der Offline-Karten.
//
// Ablauf: Regionsdatei (PMTiles) von GitHub laden → als Blob in IndexedDB →
// beim Rendern als PMTiles-Instanz an protomaps-leaflet geben (das macht
// OfflineBasemap.tsx, damit pmtiles nicht schon beim Start geladen wird).

import { dbService, type GespeicherteKarte } from './db';
import { quellUrl, type KartenRegion } from './mapRegions';

export interface Fortschritt {
  geladen: number;
  gesamt: number;
  /** 0–100, oder null wenn die Gesamtgröße unbekannt ist. */
  prozent: number | null;
}

/** Fortschritt ausrechnen. Rein, damit die Anzeige testbar bleibt —
 *  inklusive der Fälle, in denen der Server keine Größe mitschickt. */
export function berechneFortschritt(geladen: number, gesamt: number): Fortschritt {
  if (!Number.isFinite(gesamt) || gesamt <= 0) {
    return { geladen, gesamt: 0, prozent: null };
  }
  const roh = (geladen / gesamt) * 100;
  // Deckeln: Bei Umleitungen kann content-length kleiner sein als die
  // tatsächlich gelesenen Bytes — 143 % im Balken sieht kaputt aus.
  return { geladen, gesamt, prozent: Math.min(100, Math.round(roh)) };
}

type FetchArt = typeof fetch;

/** Größe der Teilstücke im Browser. Dort läuft der Download über die Funktion
 *  /api/karte, und Vercel-Funktionen dürfen höchstens 4,5 MB zurückgeben - eine
 *  Kartenregion hat rund 150 MB. In Teilstücken (Range) passt jedes darunter. */
export const TEIL_BYTES = 4 * 1024 * 1024;

/** Gesamtgröße aus „Content-Range: bytes 0-4194303/157286400“, sonst null. */
export function gesamtAusContentRange(kopf: string | null): number | null {
  const treffer = kopf?.match(/\/(\d+)\s*$/);
  return treffer ? Number(treffer[1]) : null;
}

async function ladeInTeilen(
  url: string,
  onFortschritt: ((f: Fortschritt) => void) | undefined,
  hole: FetchArt,
  teilBytes: number,
): Promise<Blob> {
  const teile: Blob[] = [];
  let geladen = 0;
  let gesamt: number | null = null;
  for (;;) {
    const bis = gesamt == null ? geladen + teilBytes - 1 : Math.min(geladen + teilBytes, gesamt) - 1;
    const antwort = await hole(url, { headers: { Range: `bytes=${geladen}-${bis}` } });
    if (antwort.status === 200 && geladen === 0) {
      // Server ohne Range (z.B. lokaler Express-Server): die Datei kommt am Stück.
      const ganz = await antwort.blob();
      onFortschritt?.(berechneFortschritt(ganz.size, ganz.size));
      return ganz;
    }
    if (antwort.status !== 206) {
      throw new Error(`Karte nicht erreichbar (HTTP ${antwort.status}).`);
    }
    gesamt ??= gesamtAusContentRange(antwort.headers.get('content-range'));
    const teil = await antwort.blob();
    teile.push(teil);
    geladen += teil.size;
    onFortschritt?.(berechneFortschritt(geladen, gesamt ?? 0));
    const fertig = gesamt != null ? geladen >= gesamt : teil.size < teilBytes;
    if (fertig || teil.size === 0) break;
  }
  return new Blob(teile);
}

/** Lädt die Region und legt sie in der Datenbank ab.
 *
 *  Im Browser in Teilstücken (siehe TEIL_BYTES), mit echtem Fortschritt.
 *  Nativ (CapacitorHttp, direkt von GitHub) in einem Stück: onFortschritt
 *  kommt dann nur, wenn der Körper als Strom lesbar ist - sonst bleibt der
 *  Balken unbestimmt. Lieber ein unbestimmter Balken als ein erfundener. */
export async function ladeRegion(
  region: KartenRegion,
  nativ: boolean,
  onFortschritt?: (f: Fortschritt) => void,
  hole: FetchArt = fetch,
  teilBytes = TEIL_BYTES,
): Promise<GespeicherteKarte> {
  const url = quellUrl(region, nativ);
  if (!nativ) return speichere(region, await ladeInTeilen(url, onFortschritt, hole, teilBytes));
  const antwort = await hole(url);
  if (!antwort.ok) {
    throw new Error(`Karte nicht erreichbar (HTTP ${antwort.status}).`);
  }

  const gesamt = Number(antwort.headers.get('content-length') ?? '0');
  let blob: Blob;

  if (antwort.body && typeof antwort.body.getReader === 'function' && onFortschritt) {
    const leser = antwort.body.getReader();
    const teile: Uint8Array[] = [];
    let geladen = 0;
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      if (value) {
        teile.push(value);
        geladen += value.length;
        onFortschritt(berechneFortschritt(geladen, gesamt));
      }
    }
    blob = new Blob(teile as BlobPart[]);
  } else {
    blob = await antwort.blob();
    onFortschritt?.(berechneFortschritt(blob.size, blob.size));
  }
  return speichere(region, blob);
}

async function speichere(region: KartenRegion, blob: Blob): Promise<GespeicherteKarte> {
  const karte: GespeicherteKarte = {
    code: region.code,
    name: region.name,
    blob,
    groesse: blob.size,
    geladenAm: Date.now(),
  };
  await dbService.saveMapRegion(karte);
  return karte;
}

/** Die zuletzt geladene Karte, die diesen Standort abdeckt — oder null. */
export async function karteFuerStandort(
  codes: string[]
): Promise<GespeicherteKarte | null> {
  if (codes.length === 0) return null;
  const gespeichert = await dbService.getMapRegions();
  const passend = gespeichert.filter((k) => codes.includes(k.code));
  if (passend.length === 0) return null;
  return passend.sort((a, b) => b.geladenAm - a.geladenAm)[0];
}
