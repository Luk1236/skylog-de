// Flug-Statistiken. Reine Berechnung aus den vorhandenen Flügen — kein Netz,
// keine Seiteneffekte, damit alles testbar bleibt.

import type { Flight, Drone } from './db';

export interface MonatsWert {
  label: string;   // z.B. "Jul 26"
  monat: string;   // "2026-07"
  fluege: number;
  minuten: number;
}

export interface DrohnenWert {
  droneId: string;
  model: string;
  fluege: number;
  minuten: number;
}

export interface OrtsWert {
  ort: string;
  anzahl: number;
}

export interface FlugStatistik {
  anzahlFluege: number;
  gesamtMinuten: number;
  starts: number;          // Anzahl Starts (aus Legs, sonst = Flüge)
  schnittMinuten: number;  // Ø Flugdauer
  laengsterMinuten: number;
  aktiveTage: number;      // Tage mit mind. einem Flug
  diesesJahrMinuten: number;
  diesesJahrFluege: number;
  vorfallAnzahl: number;
  vorfallRateProzent: number;
  proMonat: MonatsWert[];  // letzte 12 Monate
  proDrohne: DrohnenWert[];
  topOrte: OrtsWert[];     // die häufigsten 5
}

const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** "2h 05m" aus Minuten. Für die Anzeige. */
export function formatDauer(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h > 0 ? `${h}h ${String(rest).padStart(2, '0')}m` : `${rest}m`;
}

export function berechneStatistik(
  flights: Flight[],
  drones: Drone[],
  now: Date = new Date()
): FlugStatistik {
  const anzahlFluege = flights.length;
  const gesamtMinuten = flights.reduce((s, f) => s + (f.duration || 0), 0);

  const starts = flights.reduce(
    (s, f) => s + (f.legs && f.legs.length > 0 ? f.legs.length : 1),
    0
  );

  const schnittMinuten = anzahlFluege > 0 ? Math.round(gesamtMinuten / anzahlFluege) : 0;
  const laengsterMinuten = flights.reduce((m, f) => Math.max(m, f.duration || 0), 0);

  const aktiveTage = new Set(flights.map(f => f.date)).size;

  const jahr = now.getFullYear();
  const diesesJahr = flights.filter(f => new Date(f.date).getFullYear() === jahr);
  const diesesJahrMinuten = diesesJahr.reduce((s, f) => s + (f.duration || 0), 0);
  const diesesJahrFluege = diesesJahr.length;

  const vorfallAnzahl = flights.filter(f => f.incidents && f.incidents.trim()).length;
  const vorfallRateProzent = anzahlFluege > 0
    ? Math.round((vorfallAnzahl / anzahlFluege) * 1000) / 10
    : 0;

  // Letzte 12 Monate als feste Achse (auch Monate ohne Flug bleiben sichtbar).
  const proMonat: MonatsWert[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monat = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    proMonat.push({
      label: `${MONATE_KURZ[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      monat,
      fluege: 0,
      minuten: 0,
    });
  }
  const monatIndex = new Map(proMonat.map((m, i) => [m.monat, i]));
  for (const f of flights) {
    const monat = (f.date || '').slice(0, 7);
    const idx = monatIndex.get(monat);
    if (idx !== undefined) {
      proMonat[idx].fluege += 1;
      proMonat[idx].minuten += f.duration || 0;
    }
  }

  // Flugzeit je Drohne, absteigend.
  const drohnenMap = new Map<string, DrohnenWert>();
  for (const f of flights) {
    const model = drones.find(d => d.id === f.droneId)?.model ?? 'Gelöschte Drohne';
    const w = drohnenMap.get(f.droneId) ?? { droneId: f.droneId, model, fluege: 0, minuten: 0 };
    w.fluege += 1;
    w.minuten += f.duration || 0;
    drohnenMap.set(f.droneId, w);
  }
  const proDrohne = [...drohnenMap.values()].sort((a, b) => b.minuten - a.minuten);

  // Top-Standorte nach Häufigkeit.
  const orteMap = new Map<string, number>();
  for (const f of flights) {
    const ort = (f.locationName || '').trim() || 'Unbekannt';
    orteMap.set(ort, (orteMap.get(ort) ?? 0) + 1);
  }
  const topOrte = [...orteMap.entries()]
    .map(([ort, anzahl]) => ({ ort, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl)
    .slice(0, 5);

  return {
    anzahlFluege,
    gesamtMinuten,
    starts,
    schnittMinuten,
    laengsterMinuten,
    aktiveTage,
    diesesJahrMinuten,
    diesesJahrFluege,
    vorfallAnzahl,
    vorfallRateProzent,
    proMonat,
    proDrohne,
    topOrte,
  };
}
