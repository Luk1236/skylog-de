// Import von Flugaufzeichnungen (Airdata-CSV und verwandte Exporte).
//
// Grundsatz: NICHT auf feste Spaltennamen bauen. DJI-Modelle und
// Airdata-Kontoeinstellungen liefern unterschiedliche Kopfzeilen und
// Einheiten. Stattdessen werden Spalten über Synonyme erkannt, Einheiten aus
// dem Kopf gelesen und das Ergebnis dem Nutzer zur Bestätigung vorgelegt,
// bevor irgendetwas in die Datenbank geht.

import type { Flight, Drone } from './db';

/** Felder, die wir aus einer Zeile gewinnen wollen. */
export type Feld =
  | 'datum'
  | 'startzeit'
  | 'dauer'
  | 'breite'
  | 'laenge'
  | 'ort'
  | 'maxHoehe'
  | 'distanz'
  | 'akkuStart'
  | 'akkuEnde'
  | 'modell';

/** Schreibweisen, unter denen ein Feld in Exporten auftaucht.
 *  Alles kleingeschrieben und ohne Sonderzeichen verglichen — neue Variante
 *  ergänzen heißt: eine Zeichenkette in die passende Liste eintragen. */
const SYNONYME: Record<Feld, string[]> = {
  datum:     ['date', 'datum', 'flightdate', 'starttime', 'startzeit', 'timestamp', 'datetime', 'customupdatetime', 'osdupdatetime'],
  startzeit: ['starttime', 'startzeit', 'takeofftime', 'timestamp', 'datetime', 'time', 'customupdatetime'],
  dauer:     ['duration', 'dauer', 'flighttime', 'flugzeit', 'totaltime', 'totalflighttime', 'osdflytime', 'flytime'],
  breite:    ['latitude', 'lat', 'breite', 'breitengrad', 'startlatitude', 'takeofflatitude', 'osdlatitude'],
  laenge:    ['longitude', 'lon', 'lng', 'laenge', 'langengrad', 'startlongitude', 'takeofflongitude', 'osdlongitude'],
  ort:       ['location', 'ort', 'place', 'locationname', 'ortsname', 'city', 'address'],
  maxHoehe:  ['maxheight', 'maxaltitude', 'maxhoehe', 'hoehe', 'height', 'altitude', 'osdheight', 'osdaltitude'],
  distanz:   ['distance', 'distanz', 'maxdistance', 'totaldistance', 'strecke', 'osddistance'],
  akkuStart: ['batterystart', 'akkustart', 'startbattery', 'batterypercentstart', 'batterybegin', 'osdbattery'],
  akkuEnde:  ['batteryend', 'akkuende', 'endbattery', 'batterypercentend', 'osdbatterypercent'],
  modell:    ['model', 'modell', 'aircraft', 'aircraftname', 'dronemodel', 'drone', 'dronetype', 'producttype'],
};

/** Reihenfolge zählt: 'datum' und 'startzeit' teilen sich Synonyme.
 *  Spezifischere Felder zuerst zuordnen, damit sie die Spalte bekommen. */
const ZUORDNUNGS_REIHENFOLGE: Feld[] = [
  'breite', 'laenge', 'maxHoehe', 'distanz', 'akkuStart', 'akkuEnde',
  'modell', 'ort', 'dauer', 'datum', 'startzeit',
];

export interface SpaltenTreffer {
  spalte: string;
  index: number;
  /** Aus dem Kopf gelesene Einheit, z. B. 'ft', 'm', 'mph'. */
  einheit?: string;
}

export interface ImportKandidat {
  zeile: number;
  flug: Partial<Flight>;
  hinweise: string[];
  /** id eines bereits vorhandenen Fluges, falls dies eine Dublette ist. */
  dubletteVon?: string;
  /** Rohtext der Modellspalte, für die Drohnen-Zuordnung. */
  modellText?: string;
  /** Höhe/Distanz in Metern — noch ohne eigenes Feld im Flight-Modell. */
  maxHoeheM?: number;
  distanzM?: number;
}

export interface ImportVorschau {
  zuordnung: Partial<Record<Feld, SpaltenTreffer>>;
  nichtZugeordnet: string[];
  kandidaten: ImportKandidat[];
  fehler: string[];
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Trennzeichen raten. Deutsche Exporte nutzen oft Semikolon. Gezählt wird
 *  nur in der Kopfzeile, damit Kommas in Ortsnamen nicht das Ergebnis kippen. */
export function erkenneTrennzeichen(kopfzeile: string): string {
  const kandidaten = [',', ';', '\t'];
  let bestes = ',';
  let maxAnzahl = 0;
  for (const t of kandidaten) {
    const anzahl = kopfzeile.split(t).length - 1;
    if (anzahl > maxAnzahl) {
      maxAnzahl = anzahl;
      bestes = t;
    }
  }
  return bestes;
}

/** CSV nach RFC 4180: Anführungszeichen schützen Trennzeichen und Zeilen-
 *  umbrüche, "" innerhalb eines Feldes ist ein echtes Anführungszeichen. */
export function parseCsv(text: string, trennzeichen?: string): string[][] {
  const sauber = text.replace(/^﻿/, ''); // BOM aus Excel-Exporten
  const ersteZeile = sauber.split(/\r?\n/)[0] ?? '';
  const t = trennzeichen ?? erkenneTrennzeichen(ersteZeile);

  const zeilen: string[][] = [];
  let feld = '';
  let zeile: string[] = [];
  let inAnfuehrung = false;

  for (let i = 0; i < sauber.length; i++) {
    const z = sauber[i];

    if (inAnfuehrung) {
      if (z === '"') {
        if (sauber[i + 1] === '"') { feld += '"'; i++; }
        else inAnfuehrung = false;
      } else feld += z;
      continue;
    }

    if (z === '"') { inAnfuehrung = true; continue; }
    if (z === t) { zeile.push(feld); feld = ''; continue; }
    if (z === '\n') {
      zeile.push(feld.replace(/\r$/, ''));
      zeilen.push(zeile);
      zeile = []; feld = '';
      continue;
    }
    feld += z;
  }

  if (feld !== '' || zeile.length > 0) {
    zeile.push(feld.replace(/\r$/, ''));
    zeilen.push(zeile);
  }

  return zeilen.filter(r => r.some(f => f.trim() !== ''));
}

// ---------------------------------------------------------------------------
// Spaltenzuordnung
// ---------------------------------------------------------------------------

/** Kopf auf Vergleichsform bringen: klein, ohne Einheit-Klammer, ohne
 *  Sonderzeichen. "Max Height (ft)" -> "maxheight" */
function normalisiere(kopf: string): string {
  return kopf
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Einheit aus dem Kopf ziehen: "Distance (ft)" -> "ft" */
function leseEinheit(kopf: string): string | undefined {
  const treffer = kopf.match(/[([]\s*([a-zA-Z/%]+)\s*[)\]]/);
  return treffer ? treffer[1].toLowerCase() : undefined;
}

export function ordneSpaltenZu(kopfzeile: string[]): {
  zuordnung: Partial<Record<Feld, SpaltenTreffer>>;
  nichtZugeordnet: string[];
} {
  const zuordnung: Partial<Record<Feld, SpaltenTreffer>> = {};
  const belegt = new Set<number>();

  for (const feld of ZUORDNUNGS_REIHENFOLGE) {
    const synonyme = SYNONYME[feld];
    for (let i = 0; i < kopfzeile.length; i++) {
      if (belegt.has(i)) continue;
      if (synonyme.includes(normalisiere(kopfzeile[i]))) {
        zuordnung[feld] = { spalte: kopfzeile[i], index: i, einheit: leseEinheit(kopfzeile[i]) };
        belegt.add(i);
        break;
      }
    }
  }

  const nichtZugeordnet = kopfzeile.filter((_, i) => !belegt.has(i));
  return { zuordnung, nichtZugeordnet };
}

// ---------------------------------------------------------------------------
// Werte
// ---------------------------------------------------------------------------

/** Zahl lesen und dabei deutsche Dezimalkommas vertragen. */
export function leseZahl(roh: string): number | null {
  if (!roh) return null;
  const bereinigt = roh.trim().replace(/[^\d,.\-]/g, '');
  if (!bereinigt) return null;
  // "1.234,56" -> deutsch;  "1,234.56" -> englisch
  const letztesKomma = bereinigt.lastIndexOf(',');
  const letzterPunkt = bereinigt.lastIndexOf('.');
  let normal = bereinigt;
  if (letztesKomma > letzterPunkt) normal = bereinigt.replace(/\./g, '').replace(',', '.');
  else normal = bereinigt.replace(/,/g, '');
  const wert = Number(normal);
  return Number.isFinite(wert) ? wert : null;
}

/** Längen auf Meter bringen. */
export function inMeter(wert: number, einheit?: string): number {
  switch (einheit) {
    case 'ft': case 'feet': case 'foot': return wert * 0.3048;
    case 'km':                            return wert * 1000;
    case 'mi': case 'miles':              return wert * 1609.344;
    default:                              return wert; // m oder unbekannt
  }
}

/** Dauer in Sekunden. Verträgt "185", "3:05", "1:02:03" und "3,5" (Minuten). */
export function leseDauer(roh: string, einheit?: string): number | null {
  if (!roh) return null;
  const text = roh.trim();

  if (text.includes(':')) {
    const teile = text.split(':').map(t => Number(t.trim()));
    if (teile.some(t => !Number.isFinite(t))) return null;
    if (teile.length === 2) return teile[0] * 60 + teile[1];
    if (teile.length === 3) return teile[0] * 3600 + teile[1] * 60 + teile[2];
    return null;
  }

  const zahl = leseZahl(text);
  if (zahl === null) return null;

  // Ohne Einheit-Angabe ist die Zahl mehrdeutig. Airdata liefert typisch
  // Sekunden; sehr kleine Werte sind aber fast sicher Minuten.
  if (einheit === 's' || einheit === 'sec' || einheit === 'seconds') return zahl;
  if (einheit === 'min' || einheit === 'minutes' || einheit === 'm') return zahl * 60;
  return zahl < 60 ? zahl * 60 : zahl;
}

export interface DatumErgebnis {
  /** ISO-Datum YYYY-MM-DD */
  datum: string | null;
  /** HH:MM, falls im Wert enthalten */
  zeit: string | null;
  /** Gesetzt, wenn Tag/Monat nicht eindeutig unterscheidbar waren. */
  mehrdeutig: boolean;
}

/** Datum lesen. Der heikle Fall ist "03/04/2026" — das ist je nach Herkunft
 *  der 3. April oder der 4. März. Wir raten nicht still, sondern melden es. */
export function leseDatum(roh: string): DatumErgebnis {
  const leer: DatumErgebnis = { datum: null, zeit: null, mehrdeutig: false };
  if (!roh?.trim()) return leer;
  const text = roh.trim();

  const zeitTreffer = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const zeit = zeitTreffer
    ? `${zeitTreffer[1].padStart(2, '0')}:${zeitTreffer[2]}`
    : null;

  // ISO: 2026-07-19
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { datum: `${iso[1]}-${iso[2]}-${iso[3]}`, zeit, mehrdeutig: false };

  // Punktformat ist im deutschen Raum eindeutig Tag.Monat.Jahr
  const punkt = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (punkt) {
    return {
      datum: `${punkt[3]}-${punkt[2].padStart(2, '0')}-${punkt[1].padStart(2, '0')}`,
      zeit,
      mehrdeutig: false,
    };
  }

  // Schrägstrich: mehrdeutig, sofern die erste Zahl nicht > 12 ist
  const strich = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (strich) {
    const a = Number(strich[1]);
    const b = Number(strich[2]);
    if (a > 12) {
      // muss Tag sein
      return { datum: `${strich[3]}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`, zeit, mehrdeutig: false };
    }
    if (b > 12) {
      // muss Monat/Tag US-Reihenfolge sein
      return { datum: `${strich[3]}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`, zeit, mehrdeutig: false };
    }
    // Beide <= 12: nicht entscheidbar. Airdata exportiert US-Format,
    // also MM/DD annehmen — aber als mehrdeutig markieren.
    return {
      datum: `${strich[3]}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`,
      zeit,
      mehrdeutig: true,
    };
  }

  return { ...leer, zeit };
}

// ---------------------------------------------------------------------------
// Dublettenprüfung
// ---------------------------------------------------------------------------

/** Zwei Flüge gelten als derselbe, wenn Datum und Startzeit auf wenige
 *  Minuten zusammenfallen. Reine Datumsgleichheit reicht nicht — an einem
 *  Tag fliegt man mehrfach. */
export function istDublette(
  kandidat: Partial<Flight>,
  vorhanden: Flight[],
  toleranzMinuten = 3
): Flight | undefined {
  if (!kandidat.date) return undefined;

  return vorhanden.find(f => {
    if (f.date !== kandidat.date) return false;
    if (!kandidat.startTime || !f.startTime) return true; // gleiches Datum, keine Zeit: verdächtig
    const [ks, km] = kandidat.startTime.split(':').map(Number);
    const [vs, vm] = f.startTime.split(':').map(Number);
    if ([ks, km, vs, vm].some(n => !Number.isFinite(n))) return false;
    return Math.abs((ks * 60 + km) - (vs * 60 + vm)) <= toleranzMinuten;
  });
}

// ---------------------------------------------------------------------------
// Drohnen-Zuordnung und Umwandlung in einen speicherbaren Flug
// ---------------------------------------------------------------------------

/** Sucht zum Modelltext aus der CSV die passende Drohne aus der Garage.
 *  Vergleicht ohne Leerzeichen/Bindestriche, damit "Mini 4 Pro",
 *  "Mini-4-Pro" und "DJI Mini 4 Pro" zueinander finden. */
export function passendeDrohne(modellText: string | undefined, drohnen: Drone[]): Drone | undefined {
  if (!modellText?.trim()) return undefined;
  const schluessel = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const gesucht = schluessel(modellText);
  if (!gesucht) return undefined;

  // Erst exakt, dann Teilstring in beide Richtungen ("DJI Mini 4 Pro" vs "Mini 4 Pro").
  return (
    drohnen.find(d => schluessel(d.model) === gesucht) ??
    drohnen.find(d => d.name && schluessel(d.name) === gesucht) ??
    drohnen.find(d => gesucht.includes(schluessel(d.model)) || schluessel(d.model).includes(gesucht))
  );
}

/** Endzeit aus Startzeit + Dauer. Läuft über Mitternacht korrekt weiter. */
export function berechneEndzeit(startzeit: string, dauerMinuten: number): string {
  const [h, m] = startzeit.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const gesamt = (h * 60 + m + Math.max(0, dauerMinuten)) % (24 * 60);
  return `${String(Math.floor(gesamt / 60)).padStart(2, '0')}:${String(gesamt % 60).padStart(2, '0')}`;
}

/** Macht aus einem Kandidaten einen vollständigen, speicherbaren Flug.
 *  Die Drohne muss von außen kommen — sie steht so nicht in der CSV. */
export function zuFlug(kandidat: ImportKandidat, droneId: string): Flight {
  const f = kandidat.flug;
  const startTime = f.startTime || '';
  const duration = f.duration ?? 0;

  // Was kein eigenes Feld hat, wird in den Notizen festgehalten statt verworfen.
  const notizTeile = ['Importiert aus Flugaufzeichnung'];
  if (kandidat.maxHoeheM !== undefined) notizTeile.push(`max. Höhe ${kandidat.maxHoeheM} m`);
  if (kandidat.distanzM !== undefined) notizTeile.push(`Distanz ${kandidat.distanzM} m`);

  const koordinaten: [number, number] = f.coordinates ?? [0, 0];

  return {
    id: crypto.randomUUID(),
    droneId,
    date: f.date ?? '',
    startTime,
    endTime: startTime ? berechneEndzeit(startTime, duration) : '',
    duration,
    location: f.locationName ?? '',
    locationName: f.locationName ?? '',
    coordinates: koordinaten,
    batteryStatus: f.batteryStatus,
    notes: notizTeile.join(' · '),
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------

export function baueVorschau(csvText: string, vorhandeneFluege: Flight[] = []): ImportVorschau {
  const zeilen = parseCsv(csvText);
  if (zeilen.length < 2) {
    return {
      zuordnung: {}, nichtZugeordnet: [], kandidaten: [],
      fehler: ['Die Datei enthält keine auswertbaren Zeilen (Kopfzeile plus mindestens ein Flug erwartet).'],
    };
  }

  const [kopf, ...daten] = zeilen;
  const { zuordnung, nichtZugeordnet } = ordneSpaltenZu(kopf);
  const fehler: string[] = [];

  if (!zuordnung.datum && !zuordnung.startzeit) {
    fehler.push('Keine Datumsspalte erkannt — ohne Datum lässt sich kein Flug anlegen.');
  }
  if (!zuordnung.dauer) {
    fehler.push('Keine Spalte für die Flugdauer erkannt.');
  }
  if (fehler.length > 0) {
    return { zuordnung, nichtZugeordnet, kandidaten: [], fehler };
  }

  const hole = (zeile: string[], feld: Feld): string =>
    zuordnung[feld] ? (zeile[zuordnung[feld]!.index] ?? '').trim() : '';

  const kandidaten: ImportKandidat[] = daten.map((zeile, i) => {
    const hinweise: string[] = [];

    const datumRoh = hole(zeile, 'datum') || hole(zeile, 'startzeit');
    const { datum, zeit, mehrdeutig } = leseDatum(datumRoh);
    if (mehrdeutig) {
      hinweise.push(`Datum "${datumRoh}" ist mehrdeutig (Tag/Monat). Als Monat/Tag gelesen — bitte prüfen.`);
    }
    if (!datum) hinweise.push(`Datum aus "${datumRoh}" nicht lesbar.`);

    const dauerSek = leseDauer(hole(zeile, 'dauer'), zuordnung.dauer?.einheit);
    if (dauerSek === null) hinweise.push('Flugdauer nicht lesbar.');

    const breite = leseZahl(hole(zeile, 'breite'));
    const laenge = leseZahl(hole(zeile, 'laenge'));
    if ((breite === null) !== (laenge === null)) {
      hinweise.push('Nur eine der beiden Koordinaten gefunden — Position wird verworfen.');
    }

    const hoeheRoh = leseZahl(hole(zeile, 'maxHoehe'));
    const distanzRoh = leseZahl(hole(zeile, 'distanz'));

    const flug: Partial<Flight> = {
      date: datum ?? '',
      startTime: zeit ?? '',
      duration: dauerSek !== null ? Math.round(dauerSek / 60) : 0,
      locationName: hole(zeile, 'ort') || undefined,
      coordinates:
        breite !== null && laenge !== null ? [breite, laenge] : undefined,
    };

    const akkuStart = leseZahl(hole(zeile, 'akkuStart'));
    const akkuEnde = leseZahl(hole(zeile, 'akkuEnde'));
    if (akkuStart !== null || akkuEnde !== null) {
      flug.batteryStatus = {
        startPercent: akkuStart ?? undefined,
        endPercent: akkuEnde ?? undefined,
      };
    }

    // Höhe/Distanz haben noch kein eigenes Feld im Flight-Modell. Statt sie
    // wegzuwerfen, wandern sie später in die Notizen — die Daten sind da.
    const maxHoeheM = hoeheRoh !== null
      ? Math.round(inMeter(hoeheRoh, zuordnung.maxHoehe?.einheit))
      : undefined;
    const distanzM = distanzRoh !== null
      ? Math.round(inMeter(distanzRoh, zuordnung.distanz?.einheit))
      : undefined;

    const treffer = istDublette(flug, vorhandeneFluege);

    return {
      zeile: i + 2, // +1 für Kopfzeile, +1 weil Menschen ab 1 zählen
      flug,
      hinweise,
      dubletteVon: treffer?.id,
      modellText: hole(zeile, 'modell') || undefined,
      maxHoeheM,
      distanzM,
    };
  });

  return { zuordnung, nichtZugeordnet, kandidaten, fehler };
}
