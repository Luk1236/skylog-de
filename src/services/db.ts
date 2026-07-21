import { openDB, type IDBPDatabase } from 'idb';

export type UASClass = 'C0' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'Legacy' | 'Self-built';

export interface Drone {
  id: string;
  name?: string;
  model: string;
  weight: number;
  uasClass: UASClass;
  eId: string;
  serialNumber?: string;
  firmwareVersion?: string;
  insuranceNumber?: string;
  lastMotorClean?: number;
  maxWindSpeed?: number;
  photoUrl?: string;
  // Wartung & Garantie
  purchaseDate?: string;              // ISO — Basis für Garantie & erstes Intervall
  warrantyUntil?: string;             // ISO — Garantie läuft bis
  maintenanceIntervalDays?: number;   // Wartung fällig nach so vielen Tagen
  maintenanceIntervalHours?: number;  // …oder nach so vielen Flugstunden
  createdAt: number;
}

export interface Battery {
  id: string;
  droneId?: string;
  number: string;
  cycles: number;
  health?: number;
  createdAt: number;
}

export interface UserProfile {
  id: 'main_profile';
  name: string;
  eid: string;
  licenseType: 'A1/A3' | 'A2' | 'STS' | 'None';
  licenseExpiry?: string;
  insuranceNumber: string;
  isBOS?: boolean;
  notamClientId?: string;
  notamClientSecret?: string;
}

export interface FlightLeg {
  startTime: number;
  endTime: number;
  duration: number; // seconds
}

// Ein Punkt der Flugaufzeichnung. Zeit als Sekunden ab Start, damit die
// Diagramme unabhängig vom absoluten Zeitstempel sind. Alle Felder außer t
// sind optional — nicht jeder Export liefert Höhe/Speed/Akku.
export interface TrackPoint {
  t: number;         // Sekunden seit Start
  lat: number;
  lon: number;
  alt?: number;      // Meter über Startpunkt
  speed?: number;    // km/h
  battery?: number;  // Prozent
}

export interface Flight {
  id: string;
  droneId: string;
  batteryId?: string;
  pilotId?: string;
  pilotName?: string;
  isGuest?: boolean;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // total minutes
  legs?: FlightLeg[];
  track?: TrackPoint[];  // optionale Flugaufzeichnung (GPS/Höhe/Speed/Akku über Zeit)
  location: string;
  locationName: string;
  coordinates: [number, number];
  weather?: {
    temp: number;
    windSpeed: number;
    condition: string;
    visibility?: string;
    kIndex?: number;
  };
  batteryStatus?: {
    startPercent?: number;
    endPercent?: number;
    startVoltage?: number;
    endVoltage?: number;
  };
  purpose?: 'Hobby' | 'Gewerblich' | 'Inspektion' | 'Kamerafahrt' | 'Training';
  incidents?: string;
  incidentPhoto?: string;
  notes: string;
  createdAt: number;
}

export interface AppDocument {
  id: string;
  name: string;
  type: string;
  data: Blob;
  createdAt: number;
}

export interface MaintenanceRecord {
  id: string;
  droneId: string;
  date: string;
  type: 'Propeller' | 'Firmware' | 'Motor' | 'Sensor' | 'General';
  description: string;
  hoursAtMaintenance?: number;
  cost?: number;         // Kosten der Wartung in Euro
  createdAt: number;
}

export interface Pilot {
  id: string;
  name: string;
  eid: string;
  isGuest: boolean;
  createdAt: number;
}

export interface SparePart {
  id: string;
  name: string;
  description: string;
  stlUrl: string;
  printable: boolean;
}

const DB_NAME = 'skylog_db_v3';
const DRONES_STORE = 'drones';
const FLIGHTS_STORE = 'flights';
const DOCUMENTS_STORE = 'documents';
const BATTERIES_STORE = 'batteries';
const PROFILE_STORE = 'profile';
const MAINTENANCE_STORE = 'maintenance';
const PILOTS_STORE = 'pilots';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 6, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(DRONES_STORE)) {
        db.createObjectStore(DRONES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FLIGHTS_STORE)) {
        db.createObjectStore(FLIGHTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        db.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BATTERIES_STORE)) {
        db.createObjectStore(BATTERIES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(MAINTENANCE_STORE)) {
        db.createObjectStore(MAINTENANCE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PILOTS_STORE)) {
        db.createObjectStore(PILOTS_STORE, { keyPath: 'id' });
      }
    },
  });
}

export const dbService = {
  // ... existing profile methods ...

  // Maintenance
  async getMaintenance(droneId: string): Promise<MaintenanceRecord[]> {
    const db = await getDB();
    const all = await db.getAll(MAINTENANCE_STORE);
    return all.filter(r => r.droneId === droneId);
  },
  async getAllMaintenance(): Promise<MaintenanceRecord[]> {
    const db = await getDB();
    return db.getAll(MAINTENANCE_STORE);
  },
  async saveMaintenance(record: MaintenanceRecord): Promise<void> {
    const db = await getDB();
    await db.put(MAINTENANCE_STORE, record);
  },
  async deleteMaintenance(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(MAINTENANCE_STORE, id);
  },
  // Profile
  async getProfile(): Promise<UserProfile | null> {
    const db = await getDB();
    return db.get(PROFILE_STORE, 'main_profile');
  },
  async saveProfile(profile: UserProfile): Promise<void> {
    const db = await getDB();
    await db.put(PROFILE_STORE, profile);
  },

  // Drones
  async getDrones(): Promise<Drone[]> {
    const db = await getDB();
    return db.getAll(DRONES_STORE);
  },
  async saveDrone(drone: Drone): Promise<void> {
    const db = await getDB();
    await db.put(DRONES_STORE, drone);
  },
  async deleteDrone(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(DRONES_STORE, id);
  },

  // Batteries
  async getBatteries(): Promise<Battery[]> {
    const db = await getDB();
    return db.getAll(BATTERIES_STORE);
  },
  async saveBattery(battery: Battery): Promise<void> {
    const db = await getDB();
    await db.put(BATTERIES_STORE, battery);
  },
  async deleteBattery(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(BATTERIES_STORE, id);
  },

  // Flights
  async getFlights(): Promise<Flight[]> {
    const db = await getDB();
    return db.getAll(FLIGHTS_STORE);
  },
  async saveFlight(flight: Flight): Promise<void> {
    const db = await getDB();
    await db.put(FLIGHTS_STORE, flight);
    
    // Increment battery cycles if used
    if (flight.batteryId) {
      const battery = await db.get(BATTERIES_STORE, flight.batteryId);
      if (battery) {
        battery.cycles = (battery.cycles || 0) + 1;
        await db.put(BATTERIES_STORE, battery);
      }
    }
  },
  async deleteFlight(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(FLIGHTS_STORE, id);
  },

  // Pilots
  async getPilots(): Promise<Pilot[]> {
    const db = await getDB();
    return db.getAll(PILOTS_STORE);
  },
  async savePilot(pilot: Pilot): Promise<void> {
    const db = await getDB();
    await db.put(PILOTS_STORE, pilot);
  },
  async deletePilot(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(PILOTS_STORE, id);
  },

  // Documents
  async getDocuments(): Promise<AppDocument[]> {
    const db = await getDB();
    return db.getAll(DOCUMENTS_STORE);
  },
  async saveDocument(doc: AppDocument): Promise<void> {
    const db = await getDB();
    await db.put(DOCUMENTS_STORE, doc);
  },
  async deleteDocument(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(DOCUMENTS_STORE, id);
  },

  // Backup: einen kompletten Datensatz zurueckschreiben.
  //
  // 'merge'   - vorhandene Eintraege bleiben, gleiche ids werden ueberschrieben.
  // 'replace' - die Speicher werden zuerst geleert, danach eingespielt. Das ist
  //             die echte Wiederherstellung: der Zustand entspricht hinterher
  //             exakt der Sicherungsdatei. Alles seither Erfasste geht verloren,
  //             deshalb darf das nur nach ausdruecklicher Rueckfrage passieren.
  //
  // Beides laeuft in EINER Transaktion: bricht etwas ab, wird auch das Leeren
  // zurueckgerollt - es gibt keinen Zustand mit geleerter, aber nicht wieder
  // befuellter Datenbank.
  async importAllData(payload: {
    drones: Drone[];
    flights: Flight[];
    batteries: Battery[];
    maintenance: MaintenanceRecord[];
    pilots: Pilot[];
    profile: UserProfile | null;
    documents: AppDocument[];
  }, modus: 'merge' | 'replace' = 'merge'): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(
      [DRONES_STORE, FLIGHTS_STORE, BATTERIES_STORE, MAINTENANCE_STORE, PILOTS_STORE, PROFILE_STORE, DOCUMENTS_STORE],
      'readwrite'
    );
    if (modus === 'replace') {
      for (const store of [DRONES_STORE, FLIGHTS_STORE, BATTERIES_STORE, MAINTENANCE_STORE, PILOTS_STORE, PROFILE_STORE, DOCUMENTS_STORE]) {
        tx.objectStore(store).clear();
      }
    }
    for (const d of payload.drones) tx.objectStore(DRONES_STORE).put(d);
    for (const f of payload.flights) tx.objectStore(FLIGHTS_STORE).put(f);
    for (const b of payload.batteries) tx.objectStore(BATTERIES_STORE).put(b);
    for (const m of payload.maintenance) tx.objectStore(MAINTENANCE_STORE).put(m);
    for (const p of payload.pilots) tx.objectStore(PILOTS_STORE).put(p);
    for (const doc of payload.documents) tx.objectStore(DOCUMENTS_STORE).put(doc);
    if (payload.profile) tx.objectStore(PROFILE_STORE).put(payload.profile);
    await tx.done;
  }
};
