// Fristen als Kalenderdatei (iCalendar, RFC 5545).
//
// Im Browser gibt es keine Android-Benachrichtigungen. Damit Laptop-Nutzer
// trotzdem rechtzeitig erinnert werden, lassen sich dieselben Termine wie die
// Benachrichtigungen (benachrichtigungen.ts) als .ics exportieren und in
// Outlook, Google- oder Apple-Kalender importieren. Jeder Termin hat eine feste
// UID: ein erneuter Import aktualisiert ihn statt ihn zu verdoppeln.

import type { GeplanteBenachrichtigung } from './benachrichtigungen';

/** Textwerte nach RFC 5545 maskieren. */
export function maskiere(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Zeilen nach 75 Zeichen umbrechen (Folgezeilen beginnen mit einem Leerzeichen). */
export function falte(zeile: string): string {
  if (zeile.length <= 75) return zeile;
  const teile = [zeile.slice(0, 75)];
  for (let i = 75; i < zeile.length; i += 74) teile.push(' ' + zeile.slice(i, i + 74));
  return teile.join('\r\n');
}

/** Zeitpunkt als UTC im iCalendar-Format (20261021T160000Z). */
export function utc(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function alsIcs(termine: GeplanteBenachrichtigung[], now = Date.now()): string {
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SkyLog DE//Fristen//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SkyLog DE – Fristen',
  ];
  for (const t of termine) {
    zeilen.push(
      'BEGIN:VEVENT',
      `UID:skylog-${t.id}@skylog-de`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${utc(t.zeitpunkt)}`,
      'DURATION:PT15M',
      `SUMMARY:${maskiere(t.titel)}`,
      `DESCRIPTION:${maskiere(t.text)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${maskiere(t.titel)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  zeilen.push('END:VCALENDAR');
  return zeilen.map(falte).join('\r\n') + '\r\n';
}
