import type { Flight, LocationFavorite } from './db';

/** Wo die Karte ohne GPS startet: am letzten Flugort, sonst am ersten
 *  Lieblingsort. null heißt: beim Standardort bleiben. Vorher stand die Karte
 *  ohne GPS immer in Berlin, auch wenn alle Flüge woanders lagen. */
export function startOrt(favoriten: LocationFavorite[], fluege: Flight[]): [number, number] | null {
  const gueltig = (k?: [number, number]) =>
    !!k && Number.isFinite(k[0]) && Number.isFinite(k[1]) && !(k[0] === 0 && k[1] === 0);
  const letzter = [...fluege]
    .filter(f => gueltig(f.coordinates))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (letzter) return letzter.coordinates;
  const fav = favoriten.find(f => gueltig(f.coordinates));
  return fav ? fav.coordinates : null;
}
