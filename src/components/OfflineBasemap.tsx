import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import type { Layer } from 'leaflet';

/** Rendert die mitgelieferte PMTiles-Karte als Leaflet-Ebene.
 *
 *  protomaps-leaflet ist eine klassische Leaflet-Ebene, kein react-leaflet-
 *  Baustein — deshalb der kleine Wrapper: Ebene bauen, an die Karte hängen,
 *  beim Aufräumen wieder entfernen. */
export function OfflineBasemap({ url }: { url: string }) {
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
