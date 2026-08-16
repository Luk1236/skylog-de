import { LocationFavorite } from './db';

export function createLocationFavorite(payload: {
  name: string;
  locationName: string;
  lat: number;
  lon: number;
  notes?: string;
}): LocationFavorite {
  if (!payload.name.trim()) {
    throw new Error('Name für Standort-Favorit ist erforderlich.');
  }

  if (isNaN(payload.lat) || isNaN(payload.lon) || payload.lat < -90 || payload.lat > 90 || payload.lon < -180 || payload.lon > 180) {
    throw new Error('Ungültige Koordinaten.');
  }

  return {
    id: `fav_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: payload.name.trim(),
    locationName: payload.locationName.trim() || payload.name.trim(),
    coordinates: [payload.lat, payload.lon],
    notes: payload.notes?.trim() || undefined,
    createdAt: Date.now()
  };
}

export function filterLocationFavorites(favorites: LocationFavorite[], searchQuery: string): LocationFavorite[] {
  if (!searchQuery || !searchQuery.trim()) {
    return favorites;
  }
  const query = searchQuery.toLowerCase().trim();
  return favorites.filter(fav =>
    fav.name.toLowerCase().includes(query) ||
    fav.locationName.toLowerCase().includes(query) ||
    (fav.notes && fav.notes.toLowerCase().includes(query))
  );
}

export function formatCoordinates(coords: [number, number]): string {
  return `${coords[0].toFixed(5)}°, ${coords[1].toFixed(5)}°`;
}
