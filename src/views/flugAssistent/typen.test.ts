import { describe, expect, it } from 'vitest';
import { formatZeit, summeSekunden } from './typen';

describe('formatZeit', () => {
  it('zeigt Minuten und zweistellige Sekunden', () => {
    expect(formatZeit(0)).toBe('0:00');
    expect(formatZeit(65)).toBe('1:05');
    expect(formatZeit(3600)).toBe('60:00');
  });
});

describe('summeSekunden', () => {
  it('addiert die Dauer aller Abschnitte', () => {
    expect(summeSekunden([])).toBe(0);
    expect(summeSekunden([{ startTime: 0, endTime: 1, duration: 30 }, { startTime: 2, endTime: 3, duration: 45 }])).toBe(75);
  });
});
