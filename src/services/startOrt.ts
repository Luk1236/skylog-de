import type { Flight, LocationFavorite } from './db';
import { istGueltigerOrt } from './geo';

/** Wo die Karte ohne GPS startet: am letzten Flugort, sonst am ersten
 *  Lieblingsort. null heißt: beim Standardort bleiben. Vorher stand die Karte
 *  ohne GPS immer in Berlin, auch wenn alle Flüge woanders lagen. */
export function startOrt(favoriten: LocationFavorite[], fluege: Flight[]): [number, number] | null {
  const letzter = [...fluege]
    .filter(f => istGueltigerOrt(f.coordinates))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (letzter) return letzter.coordinates;
  const fav = favoriten.find(f => istGueltigerOrt(f.coordinates));
  return fav ? fav.coordinates : null;
}
