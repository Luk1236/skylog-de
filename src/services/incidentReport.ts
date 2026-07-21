// Vorfall-Bericht für die LBA-Meldung. In Deutschland müssen schwere
// Ereignisse (Personenschaden, Kollision, Kontrollverlust) beim
// Luftfahrt-Bundesamt gemeldet werden. Dieser Dienst baut aus den Eingaben
// einen sauberen, kopierbaren Textbericht — die Meldung selbst reicht der
// Pilot über das LBA-Portal ein.

import type { UserProfile, Drone } from './db';

export interface VorfallEingabe {
  datum: string;        // ISO YYYY-MM-DD
  uhrzeit: string;      // HH:MM
  ort: string;
  koordinaten?: [number, number];
  drohne: Drone | null;
  betreiber: UserProfile | null;
  kategorie: VorfallKategorie;
  beschreibung: string;
  personenschaden: boolean;
  personenschadenDetails?: string;
  sachschaden: boolean;
  sachschadenDetails?: string;
  zeugen?: string;
  massnahmen?: string;
}

export type VorfallKategorie =
  | 'Kontrollverlust'
  | 'Kollision'
  | 'Beinahe-Kollision'
  | 'Personenschaden'
  | 'Sachschaden'
  | 'Technischer Defekt'
  | 'Flyaway'
  | 'Sonstiges';

export const VORFALL_KATEGORIEN: VorfallKategorie[] = [
  'Kontrollverlust', 'Kollision', 'Beinahe-Kollision', 'Personenschaden',
  'Sachschaden', 'Technischer Defekt', 'Flyaway', 'Sonstiges',
];

// Pflichtfelder, ohne die eine Meldung nicht sinnvoll ist. Rückgabe: Klartext-
// Bezeichnungen der fehlenden Felder (leer = alles vorhanden).
export function fehlendePflichtfelder(e: VorfallEingabe): string[] {
  const fehlt: string[] = [];
  if (!e.datum?.trim()) fehlt.push('Datum');
  if (!e.ort?.trim()) fehlt.push('Ort');
  if (!e.beschreibung?.trim()) fehlt.push('Beschreibung des Vorfalls');
  if (e.personenschaden && !e.personenschadenDetails?.trim()) fehlt.push('Details zum Personenschaden');
  return fehlt;
}

function datumDE(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : iso;
}

function zeile(label: string, wert?: string): string {
  return `${label}: ${wert && wert.trim() ? wert.trim() : '—'}`;
}

// Baut den fertigen Berichtstext. Auch bei fehlenden Pflichtfeldern nutzbar
// (dann stehen dort Striche) — die Vollständigkeit prüft der Aufrufer separat.
export function baueVorfallBericht(e: VorfallEingabe): string {
  const b = e.betreiber;
  const d = e.drohne;

  const kopf = [
    'VORFALLMELDUNG — Unbemanntes Luftfahrtsystem (UAS)',
    'Erstellt mit SkyLog DE zur Meldung beim Luftfahrt-Bundesamt (LBA).',
    '',
  ];

  const ereignis = [
    '── EREIGNIS ──',
    zeile('Datum', datumDE(e.datum)),
    zeile('Uhrzeit', e.uhrzeit),
    zeile('Ort', e.ort),
    zeile('Koordinaten', e.koordinaten ? `${e.koordinaten[0].toFixed(5)}, ${e.koordinaten[1].toFixed(5)}` : undefined),
    zeile('Kategorie', e.kategorie),
    '',
    'BESCHREIBUNG DES VORFALLS:',
    e.beschreibung?.trim() || '—',
    '',
  ];

  const folgen = [
    '── FOLGEN ──',
    zeile('Personenschaden', e.personenschaden ? `JA — ${e.personenschadenDetails?.trim() || 'ohne Details'}` : 'nein'),
    zeile('Sachschaden', e.sachschaden ? `JA — ${e.sachschadenDetails?.trim() || 'ohne Details'}` : 'nein'),
    zeile('Zeugen', e.zeugen),
    zeile('Sofortmaßnahmen', e.massnahmen),
    '',
  ];

  const geraet = [
    '── GERÄT ──',
    zeile('Modell', d ? `${d.model} (${d.uasClass}, ${d.weight} g)` : undefined),
    zeile('Drohnen-Kennung', d?.eId?.trim() || d?.serialNumber?.trim()),
    '',
  ];

  const betreiber = [
    '── BETREIBER / PILOT ──',
    zeile('Betreiber', b?.name),
    zeile('Betreiber-ID (e-ID)', b?.eid),
    zeile('Kompetenznachweis', b?.licenseType),
    zeile('Versicherung', b?.insuranceNumber),
    '',
  ];

  const hinweis = [
    '── HINWEIS ──',
    'Schwere Ereignisse binnen 72 Stunden beim LBA melden (ECCAIRS 2).',
    'Dieser Text ist eine Vorlage — die offizielle Meldung erfolgt über das LBA-Portal.',
  ];

  return [...kopf, ...ereignis, ...folgen, ...geraet, ...betreiber, ...hinweis].join('\n');
}
