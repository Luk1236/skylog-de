import { describe, it, expect } from 'vitest';
import { alsIcs, maskiere, falte, utc } from './kalender';

describe('kalender (.ics)', () => {
  it('maskiert Sonderzeichen nach RFC 5545', () => {
    expect(maskiere('A, B; C\\D\nE')).toBe('A\\, B\\; C\\\\D\\nE');
  });

  it('faltet lange Zeilen auf höchstens 75 Zeichen', () => {
    const f = falte('X'.repeat(200)).split('\r\n');
    expect(f.every(z => z.length <= 75)).toBe(true);
    expect(f.slice(1).every(z => z.startsWith(' '))).toBe(true);
    expect(f.map((z, i) => (i ? z.slice(1) : z)).join('')).toBe('X'.repeat(200));
  });

  it('formatiert UTC-Zeitpunkte', () => {
    expect(utc(Date.UTC(2026, 9, 21, 16, 0, 0))).toBe('20261021T160000Z');
  });

  it('baut einen gültigen Kalender mit stabilen UIDs und Alarm', () => {
    const ics = alsIcs([
      { id: 42, titel: 'Fernpilotenzeugnis läuft ab', text: 'In 7 Tagen, rechtzeitig verlängern.', zeitpunkt: Date.UTC(2026, 10, 1, 8, 0) },
    ], Date.UTC(2026, 9, 20, 12, 0));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('UID:skylog-42@skylog-de');
    expect(ics).toContain('DTSTART:20261101T080000Z');
    expect(ics).toContain('DESCRIPTION:In 7 Tagen\\, rechtzeitig verlängern.');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(1);
  });
});
