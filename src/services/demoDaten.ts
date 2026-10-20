// Demo-Modus: realistische Beispieldaten zum Ausprobieren und Vorführen.
//
// Ohne Daten sind Statistik, Diagramme und Flotte leer - die App wirkt beim
// ersten Öffnen nach wenig. Beispieldaten zeigen sofort, was sie kann.
// Alle IDs beginnen mit "demo-": so lassen sie sich jederzeit vollständig
// entfernen, ohne echte Einträge anzufassen. Das Pilotenprofil wird bewusst
// NICHT angelegt oder überschrieben.

import {
  dbService,
  type Battery, type Drone, type Flight, type LocationFavorite, type MaintenanceRecord, type SparePart,
} from './db';

export const DEMO_PRAEFIX = 'demo-';
const TAG = 24 * 60 * 60 * 1000;

export interface Beispieldaten {
  drones: Drone[];
  batteries: Battery[];
  flights: Flight[];
  maintenance: MaintenanceRecord[];
  spareParts: SparePart[];
  locationFavorites: LocationFavorite[];
}

const ORTE: { name: string; koord: [number, number] }[] = [
  { name: 'Darmstadt, Herrngarten', koord: [49.8768, 8.6556] },
  { name: 'Griesheim, Modellflugplatz', koord: [49.8616, 8.5712] },
  { name: 'Eberstadt, Feldrand', koord: [49.8139, 8.6517] },
  { name: 'Odenwald, Felsberg', koord: [49.7270, 8.7240] },
];

const isoTag = (t: number) => new Date(t).toISOString().slice(0, 10);
const uhrzeit = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Baut die Beispieldaten relativ zu `now` (die Flüge liegen in den letzten Monaten). */
export function erzeugeBeispieldaten(now = Date.now()): Beispieldaten {
  const drones: Drone[] = [
    {
      id: 'demo-drohne-mini', name: 'Mini 4 Pro', model: 'DJI Mini 4 Pro', weight: 249, uasClass: 'C0',
      eId: '', serialNumber: '1581F6Z9C23', firmwareVersion: '01.00.0600', maxWindSpeed: 38,
      lastMotorClean: now - 40 * TAG, purchaseDate: isoTag(now - 300 * TAG), warrantyUntil: isoTag(now + 65 * TAG),
      maintenanceIntervalDays: 90, createdAt: now - 300 * TAG,
    },
    {
      id: 'demo-drohne-air', name: 'Air 3', model: 'DJI Air 3', weight: 720, uasClass: 'C1',
      eId: '', serialNumber: '1581F5FJD24', firmwareVersion: '01.01.0300', maxWindSpeed: 43,
      lastMotorClean: now - 100 * TAG, purchaseDate: isoTag(now - 500 * TAG), warrantyUntil: isoTag(now - 135 * TAG),
      maintenanceIntervalDays: 90, createdAt: now - 500 * TAG,
    },
  ];

  const batteries: Battery[] = [
    { id: 'demo-akku-m1', droneId: 'demo-drohne-mini', number: 'Mini #1', cycles: 48, health: 94, maxCycles: 200, createdAt: now - 300 * TAG },
    { id: 'demo-akku-m2', droneId: 'demo-drohne-mini', number: 'Mini #2', cycles: 41, health: 96, maxCycles: 200, createdAt: now - 300 * TAG },
    { id: 'demo-akku-a1', droneId: 'demo-drohne-air', number: 'Air #1', cycles: 212, health: 81, maxCycles: 200, createdAt: now - 500 * TAG },
    { id: 'demo-akku-a2', droneId: 'demo-drohne-air', number: 'Air #2', cycles: 187, health: 58, maxCycles: 200, createdAt: now - 500 * TAG },
  ];

  // 14 Flüge, verteilt über die letzten ~5 Monate, mehrere in den letzten 7 Tagen
  const plan: { vorTagen: number; drohne: 0 | 1; akku: string; ort: number; min: number; zweck: Flight['purpose']; wind: number; nacht?: boolean; vorkommnis?: string }[] = [
    { vorTagen: 1, drohne: 0, akku: 'demo-akku-m1', ort: 0, min: 22, zweck: 'Hobby', wind: 12 },
    { vorTagen: 2, drohne: 0, akku: 'demo-akku-m2', ort: 1, min: 18, zweck: 'Training', wind: 9 },
    { vorTagen: 4, drohne: 1, akku: 'demo-akku-a1', ort: 3, min: 31, zweck: 'Kamerafahrt', wind: 21 },
    { vorTagen: 6, drohne: 0, akku: 'demo-akku-m1', ort: 2, min: 15, zweck: 'Hobby', wind: 14, nacht: true },
    { vorTagen: 12, drohne: 1, akku: 'demo-akku-a2', ort: 1, min: 26, zweck: 'Inspektion', wind: 17 },
    { vorTagen: 19, drohne: 0, akku: 'demo-akku-m2', ort: 0, min: 20, zweck: 'Hobby', wind: 8 },
    { vorTagen: 27, drohne: 1, akku: 'demo-akku-a1', ort: 3, min: 34, zweck: 'Gewerblich', wind: 19 },
    { vorTagen: 38, drohne: 0, akku: 'demo-akku-m1', ort: 2, min: 24, zweck: 'Kamerafahrt', wind: 11, vorkommnis: 'Greifvogel kreiste in ca. 80 m Höhe – Flug abgebrochen.' },
    { vorTagen: 52, drohne: 1, akku: 'demo-akku-a2', ort: 1, min: 21, zweck: 'Training', wind: 24 },
    { vorTagen: 66, drohne: 0, akku: 'demo-akku-m2', ort: 0, min: 17, zweck: 'Hobby', wind: 6 },
    { vorTagen: 81, drohne: 1, akku: 'demo-akku-a1', ort: 3, min: 29, zweck: 'Gewerblich', wind: 15 },
    { vorTagen: 97, drohne: 0, akku: 'demo-akku-m1', ort: 2, min: 19, zweck: 'Hobby', wind: 10 },
    { vorTagen: 118, drohne: 1, akku: 'demo-akku-a2', ort: 1, min: 27, zweck: 'Inspektion', wind: 18 },
    { vorTagen: 143, drohne: 0, akku: 'demo-akku-m2', ort: 0, min: 23, zweck: 'Kamerafahrt', wind: 13 },
  ];

  const flights: Flight[] = plan.map((f, i) => {
    const tag = now - f.vorTagen * TAG;
    const startH = f.nacht ? 21 : 10 + (i % 7);
    const ende = startH * 60 + 5 + f.min;
    const ort = ORTE[f.ort];
    const startPct = 98 - (i % 3);
    return {
      id: `demo-flug-${String(i + 1).padStart(2, '0')}`,
      droneId: drones[f.drohne].id,
      batteryId: f.akku,
      pilotName: 'Ich',
      date: isoTag(tag),
      startTime: uhrzeit(startH, 5),
      endTime: uhrzeit(Math.floor(ende / 60), ende % 60),
      duration: f.min,
      maxAltitude: 60 + ((i * 17) % 60),
      distanceKm: Math.round((0.4 + (i % 5) * 0.25) * 100) / 100,
      location: ort.name,
      locationName: ort.name,
      coordinates: ort.koord,
      weather: { temp: 8 + (i % 12), windSpeed: f.wind, condition: f.wind > 20 ? 'Windig' : 'Klar', visibility: 'Gut', kIndex: 2 },
      batteryStatus: { startPercent: startPct, endPercent: Math.max(12, startPct - f.min * 3) },
      isNightFlight: !!f.nacht,
      purpose: f.zweck,
      incidents: f.vorkommnis,
      notes: f.nacht ? 'Nachtflug mit grünem Positionslicht.' : '',
      createdAt: tag,
    };
  });

  const maintenance: MaintenanceRecord[] = [
    { id: 'demo-wartung-1', droneId: 'demo-drohne-mini', date: isoTag(now - 40 * TAG), type: 'Propeller', description: 'Propeller-Satz getauscht (Kerbe am linken vorderen Blatt).', cost: 14.9, createdAt: now - 40 * TAG },
    { id: 'demo-wartung-2', droneId: 'demo-drohne-air', date: isoTag(now - 100 * TAG), type: 'Firmware', description: 'Firmware auf 01.01.0300 aktualisiert.', createdAt: now - 100 * TAG },
  ];

  const spareParts: SparePart[] = [
    { id: 'demo-teil-1', name: 'Propeller-Satz Mini 4 Pro', beschreibung: '2 Paar, Original DJI', anzahl: 2, mindestAnzahl: 1, droneId: 'demo-drohne-mini', createdAt: now },
    { id: 'demo-teil-2', name: 'Propeller-Satz Air 3', anzahl: 1, mindestAnzahl: 2, droneId: 'demo-drohne-air', createdAt: now },
    { id: 'demo-teil-3', name: 'ND-Filter-Set', beschreibung: 'ND8/16/32', anzahl: 1, createdAt: now },
  ];

  const locationFavorites: LocationFavorite[] = ORTE.slice(0, 3).map((o, i) => ({
    id: `demo-favorit-${i + 1}`, name: o.name.split(',')[0], locationName: o.name, coordinates: o.koord, createdAt: now - i,
  }));

  return { drones, batteries, flights, maintenance, spareParts, locationFavorites };
}

/** Spielt die Beispieldaten ein (zusammenführen - echte Daten bleiben unberührt). */
export async function ladeBeispieldaten(now = Date.now()): Promise<void> {
  const d = erzeugeBeispieldaten(now);
  await dbService.importAllData({
    drones: d.drones, flights: d.flights, batteries: d.batteries, maintenance: d.maintenance,
    pilots: [], profile: null, documents: [],
    spareParts: d.spareParts, locationFavorites: d.locationFavorites,
  }, 'merge');
}

/** Gibt es aktuell Beispieldaten? */
export async function hatBeispieldaten(): Promise<boolean> {
  const drohnen = await dbService.getDrones();
  return drohnen.some(d => d.id.startsWith(DEMO_PRAEFIX));
}

/** Entfernt alle Einträge mit "demo-"-ID - und nur diese. */
export async function entferneBeispieldaten(): Promise<void> {
  const ist = (x: { id: string }) => x.id.startsWith(DEMO_PRAEFIX);
  const [fluege, drohnen, akkus, wartung, teile, favoriten] = await Promise.all([
    dbService.getFlights(), dbService.getDrones(), dbService.getBatteries(),
    dbService.getAllMaintenance(), dbService.getSpareParts(), dbService.getLocationFavorites(),
  ]);
  await Promise.all([
    ...fluege.filter(ist).map(x => dbService.deleteFlight(x.id)),
    ...drohnen.filter(ist).map(x => dbService.deleteDrone(x.id)),
    ...akkus.filter(ist).map(x => dbService.deleteBattery(x.id)),
    ...wartung.filter(ist).map(x => dbService.deleteMaintenance(x.id)),
    ...teile.filter(ist).map(x => dbService.deleteSparePart(x.id)),
    ...favoriten.filter(ist).map(x => dbService.deleteLocationFavorite(x.id)),
  ]);
}
