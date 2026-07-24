// Herunterladen und Bereitstellen der Offline-Karten.
//
// Ablauf: Regionsdatei (PMTiles) von GitHub laden → als Blob in IndexedDB →
// beim Rendern als PMTiles-Instanz an protomaps-leaflet geben. Dass
// leafletLayer `url?: PMTiles | string` akzeptiert, ist der Grund, warum hier
// keine eigene Kachelverwaltung nötig ist.

import { PMTiles, FileSource } from 'pmtiles';
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

/** Lädt die Region und legt sie in der Datenbank ab.
 *
 *  onFortschritt wird nur aufgerufen, wenn der Körper als Strom lesbar ist.
 *  Nativ (CapacitorHttp) ist das oft nicht der Fall — dann kommt die Datei in
 *  einem Stück und der Fortschritt bleibt unbestimmt. Das ist Absicht: lieber
 *  ein unbestimmter Balken als ein erfundener. */
export async function ladeRegion(
  region: KartenRegion,
  nativ: boolean,
  onFortschritt?: (f: Fortschritt) => void,
  hole: FetchArt = fetch
): Promise<GespeicherteKarte> {
  const url = quellUrl(region, nativ);
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

/** Baut aus der gespeicherten Datei die PMTiles-Quelle für die Karte.
 *  FileSource erwartet ein File — ein Blob wird dafür umhüllt. */
export function alsPmtiles(karte: GespeicherteKarte): PMTiles {
  const datei = new File([karte.blob], `${karte.code}.pmtiles`);
  return new PMTiles(new FileSource(datei));
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
