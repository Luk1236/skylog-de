import { describe, it, expect } from 'vitest';
import { createLocationFavorite, filterLocationFavorites, formatCoordinates } from './locationFavorites';
import { LocationFavorite } from './db';

describe('locationFavorites', () => {
  it('creates valid location favorite', () => {
    const fav = createLocationFavorite({
      name: 'Flugplatz Griesheim',
      locationName: 'Griesheim, Hessen',
      lat: 49.8730,
      lon: 8.6520,
      notes: 'Schöne Freifläche am Rand'
    });

    expect(fav.id).toContain('fav_');
    expect(fav.name).toBe('Flugplatz Griesheim');
    expect(fav.coordinates).toEqual([49.8730, 8.6520]);
    expect(fav.notes).toBe('Schöne Freifläche am Rand');
  });

  it('throws error for invalid coordinates or empty name', () => {
    expect(() => createLocationFavorite({
      name: '',
      locationName: 'Test',
      lat: 49.87,
      lon: 8.65
    })).toThrow('Name');

    expect(() => createLocationFavorite({
      name: 'Test',
      locationName: 'Test',
      lat: 100, // Invalid latitude
      lon: 8.65
    })).toThrow('Koordinaten');
  });

  it('filters favorites correctly by query', () => {
    const list: LocationFavorite[] = [
      { id: '1', name: 'Flugwiese Eberstadt', locationName: 'Eberstadt', coordinates: [49.86, 8.64], createdAt: 1 },
      { id: '2', name: 'Modellflugplatz Bessungen', locationName: 'Darmstadt', coordinates: [49.87, 8.65], createdAt: 2 }
    ];

    expect(filterLocationFavorites(list, 'Eberstadt').length).toBe(1);
    expect(filterLocationFavorites(list, 'Darmstadt').length).toBe(1);
    expect(filterLocationFavorites(list, 'Griesheim').length).toBe(0);
    expect(filterLocationFavorites(list, '').length).toBe(2);
  });

  it('formats coordinates nicely', () => {
    expect(formatCoordinates([49.872819, 8.651239])).toBe('49.87282°, 8.65124°');
  });
});
