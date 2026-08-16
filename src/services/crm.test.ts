import { describe, it, expect } from 'vitest';
import { calculateCustomerStats } from './crm';
import type { Flight } from './db';

describe('crm service', () => {
  it('calculates customer stats accurately', () => {
    const mockFlights: Flight[] = [
      {
        id: 'f1',
        droneId: 'd1',
        date: '2026-07-27',
        startTime: '10:00',
        endTime: '10:25',
        duration: 25,
        distanceKm: 3.5,
        location: 'Berlin',
        locationName: 'Berlin Hauptbahnhof',
        coordinates: [52.52, 13.40],
        notes: '',
        createdAt: 1000,
        customerId: 'cust1',
      },
      {
        id: 'f2',
        droneId: 'd1',
        date: '2026-07-27',
        startTime: '11:00',
        endTime: '11:35',
        duration: 35,
        distanceKm: 5.0,
        location: 'Berlin',
        locationName: 'Berlin Park',
        coordinates: [52.52, 13.40],
        notes: '',
        createdAt: 2000,
        customerId: 'cust1',
      },
      {
        id: 'f3',
        droneId: 'd1',
        date: '2026-07-27',
        startTime: '14:00',
        endTime: '14:15',
        duration: 15,
        distanceKm: 1.0,
        location: 'Potsdam',
        locationName: 'Potsdam Platz',
        coordinates: [52.40, 13.06],
        notes: '',
        createdAt: 3000,
        customerId: 'cust2',
      },
    ];

    const stats1 = calculateCustomerStats('cust1', mockFlights);
    expect(stats1.totalFlights).toBe(2);
    expect(stats1.totalDurationMinutes).toBe(60);
    expect(stats1.totalDistanceKm).toBe(8.5);

    const stats2 = calculateCustomerStats('cust2', mockFlights);
    expect(stats2.totalFlights).toBe(1);
    expect(stats2.totalDurationMinutes).toBe(15);
  });
});
