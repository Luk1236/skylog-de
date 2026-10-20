import { describe, expect, it } from 'vitest';
import { startOrt } from './startOrt';
import type { Flight, LocationFavorite } from './db';

const flug = (coordinates: [number, number], createdAt: number) => ({ coordinates, createdAt }) as Flight;
const fav = (coordinates: [number, number]) => ({ coordinates }) as LocationFavorite;

describe('startOrt', () => {
  it('nimmt den zuletzt angelegten Flug', () => {
    expect(startOrt([], [flug([49.87, 8.65], 1), flug([49.85, 8.6], 2)])).toEqual([49.85, 8.6]);
  });

  it('fällt auf den ersten Lieblingsort zurück', () => {
    expect(startOrt([fav([50.1, 8.7])], [])).toEqual([50.1, 8.7]);
  });

  it('ignoriert leere Koordinaten und liefert sonst null', () => {
    expect(startOrt([], [flug([0, 0], 5)])).toBeNull();
  });
});
