import { describe, it, expect } from 'vitest';
import { calculatePreFlightSafetyScore } from './safetyScore';

describe('safetyScore service', () => {
  it('calculates perfect 100% score for optimal conditions', () => {
    const res = calculatePreFlightSafetyScore(
      {
        temp: 22,
        windSpeed: 10,
        windSpeed120: 15,
        windGusts: 20,
        condition: 'Klar',
        visibility: 'Sehr gut',
        sunrise: '2026-07-27T06:00:00Z',
        sunset: '2026-07-27T21:00:00Z',
      },
      { id: 'd1', model: 'DJI Mavic 3', weight: 895, uasClass: 'C1', eId: 'DEU123', maxWindSpeed: 40, createdAt: 1 },
      { id: 'b1', number: 'A1', cycles: 12, health: 98, createdAt: 1 },
      { id: 'main_profile', name: 'Max', eid: 'DEU123', licenseType: 'A1/A3', insuranceNumber: '123' },
      2
    );

    expect(res.score).toBe(100);
    expect(res.status).toBe('SAFE');
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('detects high wind and solar storm warning', () => {
    const res = calculatePreFlightSafetyScore(
      {
        temp: 22,
        windSpeed: 35,
        windSpeed120: 45, // Exceeds maxWind 40
        windGusts: 50,
        condition: 'Stürmisch',
        visibility: 'Gut',
        sunrise: null,
        sunset: null,
      },
      { id: 'd1', model: 'Mavic 3', weight: 895, uasClass: 'C1', eId: 'DEU123', maxWindSpeed: 40, createdAt: 1 },
      null,
      null,
      6 // Kp 6 solar storm
    );

    expect(res.score).toBeLessThan(60);
    expect(res.status).toBe('CRITICAL');
    expect(res.items.some(i => i.status === 'fail')).toBe(true);
  });
});
