import { useEffect, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import { PMTiles, FileSource } from 'pmtiles';
import type { Layer } from 'leaflet';
import type { GespeicherteKarte } from '../services/db';
import { useDunkelmodus } from '../lib/useDunkelmodus';
import { useSprache } from '../lib/sprache';

/** Baut aus der gespeicherten Datei die PMTiles-Quelle für die Karte.
 *  FileSource erwartet ein File — ein Blob wird dafür umhüllt. */
export function alsPmtiles(karte: GespeicherteKarte): PMTiles {
  const datei = new File([karte.blob], `${karte.code}.pmtiles`);
  return new PMTiles(new FileSource(datei));
}

/** Rendert eine PMTiles-Karte als Leaflet-Ebene.
 *
 *  `quelle` ist entweder eine Adresse (mitgelieferte Datei) ODER eine
 *  heruntergeladene, in der Datenbank gespeicherte Karte; daraus wird hier die
 *  PMTiles-Instanz gebaut (leafletLayer nimmt `PMTiles | string`).
 *
 *  Diese Datei wird nur bei Bedarf geladen (lazy in DroneMap): protomaps-leaflet
 *  und pmtiles gehören nicht in den Erststart, solange keine Offline-Karte da ist.
 *
 *  protomaps-leaflet ist eine klassische Leaflet-Ebene, kein react-leaflet-
 *  Baustein — deshalb der Wrapper: Ebene bauen, anhängen, beim Aufräumen
 *  wieder entfernen. */
export function OfflineBasemap({ quelle }: { quelle: string | GespeicherteKarte }) {
  const map = useMap();
  const url = useMemo(() => (typeof quelle === 'string' ? quelle : alsPmtiles(quelle)), [quelle]);
  // Echte dunkle Karte statt Farbfilter (die Online-Kacheln gibt es nur hell),
  // Ortsnamen in der App-Sprache.
  const dunkel = useDunkelmodus();
  const { sprache } = useSprache();

  useEffect(() => {
    // protomaps-leaflet bringt eigene, lose Typen mit; fuer Leaflet ist das
    // Ergebnis eine ganz normale Ebene.
    // zIndex 0 ist hier sicherheitsrelevant, nicht kosmetisch: Diese Ebene wird
    // erst im Effekt nachgereicht und landet damit im DOM NACH der
    // Flugverbotszonen-Ebene (WMS, Leaflet-Standard zIndex 1). Ohne die 0 malt
    // die Grundkarte die Zonen zu — sie werden geladen, sind aber unsichtbar.
    // Am 2026-07-24 im Browser reproduziert und nachgeprüft.
    const ebene = leafletLayer({ url, flavor: dunkel ? 'dark' : 'light', lang: sprache, zIndex: 0 }) as unknown as Layer;
    ebene.addTo(map);
    return () => { map.removeLayer(ebene); };
  }, [map, url, dunkel, sprache]);

  return null;
}
