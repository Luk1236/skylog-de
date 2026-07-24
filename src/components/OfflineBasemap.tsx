import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import type { Layer } from 'leaflet';
import type { PMTiles } from 'pmtiles';

/** Rendert eine PMTiles-Karte als Leaflet-Ebene.
 *
 *  `url` ist entweder eine Adresse (mitgelieferte Datei) ODER eine fertige
 *  PMTiles-Instanz aus einer heruntergeladenen Datei — leafletLayer nimmt
 *  laut Typdefinition `PMTiles | string`. Genau deshalb braucht es hier keine
 *  eigene Kachelverwaltung.
 *
 *  protomaps-leaflet ist eine klassische Leaflet-Ebene, kein react-leaflet-
 *  Baustein — deshalb der Wrapper: Ebene bauen, anhängen, beim Aufräumen
 *  wieder entfernen. */
export function OfflineBasemap({ url }: { url: string | PMTiles }) {
  const map = useMap();

  useEffect(() => {
    // protomaps-leaflet bringt eigene, lose Typen mit; fuer Leaflet ist das
    // Ergebnis eine ganz normale Ebene.
    const ebene = leafletLayer({ url, flavor: 'light', lang: 'de' }) as unknown as Layer;
    ebene.addTo(map);
    return () => { map.removeLayer(ebene); };
  }, [map, url]);

  return null;
}
