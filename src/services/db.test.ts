import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Battery, Customer, Drone, Flight, FlightPlan, MaintenanceRecord, Pilot, SparePart, UserProfile } from './db';

// IndexedDB gibt es in der node-Umgebung nicht. Statt einer weiteren
// Abhängigkeit (fake-indexeddb) wird hier `idb.openDB` durch einen kleinen
// Speicher im Arbeitsspeicher ersetzt – genug für die Abläufe in db.ts
// (get/getAll/put/delete, Transaktionen, Upgrade). Echte Transaktions-
// Semantik (Abbruch, Zurückrollen) prüft das bewusst nicht.
const speicher = vi.hoisted(() => {
  type Store = { keyPath: string; daten: Map<unknown, unknown> };
  const zustand = { version: 0, stores: new Map<string, Store>(), aufrufe: [] as { name: string; version: number }[] };

  const kopie = <T,>(x: T): T => structuredClone(x);
  const store = (name: string) => {
    const s = zustand.stores.get(name);
    if (!s) throw new Error(`NotFoundError: Store ${name} fehlt`);
    return s;
  };
  const storeZugriff = (name: string) => ({
    async get(key: unknown) { const v = store(name).daten.get(key); return v === undefined ? undefined : kopie(v); },
    async getAll() { return [...store(name).daten.values()].map(kopie); },
    async put(wert: Record<string, unknown>) {
      const s = store(name);
      const key = wert[s.keyPath];
      if (key === undefined) throw new Error(`DataError: ${s.keyPath} fehlt`);
      s.daten.set(key, kopie(wert));
      return key;
    },
    async delete(key: unknown) { store(name).daten.delete(key); },
    async clear() { store(name).daten.clear(); },
  });

  const db = {
    objectStoreNames: { contains: (name: string) => zustand.stores.has(name) },
    createObjectStore(name: string, opt: { keyPath: string }) {
      zustand.stores.set(name, { keyPath: opt.keyPath, daten: new Map() });
    },
    get: (name: string, key: unknown) => storeZugriff(name).get(key),
    getAll: (name: string) => storeZugriff(name).getAll(),
    put: (name: string, wert: Record<string, unknown>) => storeZugriff(name).put(wert),
    delete: (name: string, key: unknown) => storeZugriff(name).delete(key),
    transaction(names: string | string[]) {
      const erlaubt = new Set(Array.isArray(names) ? names : [names]);
      for (const n of erlaubt) store(n);
      const offen: Promise<unknown>[] = [];
      return {
        objectStore(name: string) {
          if (!erlaubt.has(name)) throw new Error(`NotFoundError: ${name} nicht in der Transaktion`);
          const z = storeZugriff(name);
          const merke = <A extends unknown[], R>(f: (...a: A) => Promise<R>) => (...a: A) => { const p = f(...a); offen.push(p); return p; };
          return { get: merke(z.get), getAll: merke(z.getAll), put: merke(z.put), delete: merke(z.delete), clear: merke(z.clear) };
        },
        get done() { return Promise.all(offen).then(() => undefined); },
      };
    },
  };

  return {
    zustand,
    db,
    leeren() { zustand.version = 0; zustand.stores.clear(); zustand.aufrufe = []; },
    openDB: async (name: string, version: number, opt?: { upgrade?: (d: typeof db, alt: number, neu: number) => void }) => {
      zustand.aufrufe.push({ name, version });
      if (version > zustand.version) {
        opt?.upgrade?.(db, zustand.version, version);
        zustand.version = version;
      }
      return db;
    },
  };
});

vi.mock('idb', () => ({ openDB: speicher.openDB }));

const { dbService } = await import('./db');

const ALLE_STORES = {
  drones: 'id', flights: 'id', documents: 'id', batteries: 'id', profile: 'id', maintenance: 'id',
  pilots: 'id', flightplans: 'id', mapregions: 'code', euzones: 'land',
  location_favorites: 'id', customers: 'id', spare_parts: 'id',
};

function flug(over: Partial<Flight> = {}): Flight {
  return {
    id: 'f1', droneId: 'd1', date: '2026-07-19', startTime: '14:00', endTime: '14:20', duration: 20,
    location: '', locationName: 'Darmstadt', coordinates: [49.87, 8.65], notes: '', createdAt: 1, ...over,
  };
}
function akku(over: Partial<Battery> = {}): Battery {
  return { id: 'a1', number: '1', cycles: 5, createdAt: 1, ...over };
}
function drohne(over: Partial<Drone> = {}): Drone {
  return { id: 'd1', model: 'Mini 4 Pro', weight: 249, uasClass: 'C0', eId: 'DEU-123', createdAt: 1, ...over };
}
const zyklen = async (id = 'a1') => (await dbService.getBatteries()).find(b => b.id === id)?.cycles;

beforeEach(() => speicher.leeren());

describe('Datenbank öffnen und Migrationen', () => {
  it('öffnet skylog_db_v3 in Version 12', async () => {
    await dbService.getDrones();
    expect(speicher.zustand.aufrufe[0]).toEqual({ name: 'skylog_db_v3', version: 12 });
  });

  it('legt bei einer neuen Installation alle Speicher mit dem richtigen Schlüssel an', async () => {
    await dbService.getDrones();
    const angelegt = Object.fromEntries([...speicher.zustand.stores].map(([n, s]) => [n, s.keyPath]));
    expect(angelegt).toEqual(ALLE_STORES);
  });

  it('ergänzt beim Update von v7 nur die neuen Speicher und behält die Daten', async () => {
    // Stand v7: bis einschließlich Flugpläne.
    speicher.zustand.version = 7;
    for (const n of ['drones', 'flights', 'documents', 'batteries', 'profile', 'maintenance', 'pilots', 'flightplans']) {
      speicher.db.createObjectStore(n, { keyPath: 'id' });
    }
    await speicher.db.put('flights', flug() as unknown as Record<string, unknown>);

    expect(await dbService.getFlights()).toEqual([flug()]);
    expect(speicher.zustand.version).toBe(12);
    expect(speicher.zustand.stores.get('mapregions')?.keyPath).toBe('code');
    expect(speicher.zustand.stores.get('euzones')?.keyPath).toBe('land');
    expect(speicher.zustand.stores.has('spare_parts')).toBe(true);
  });

  it('lässt eine aktuelle Datenbank unverändert', async () => {
    await dbService.getDrones();
    await dbService.saveDrone(drohne());
    await dbService.getDrones();
    expect(await dbService.getDrones()).toEqual([drohne()]);
  });
});

describe('Flug speichern, löschen, wiederherstellen', () => {
  it('speichert und liest einen Flug', async () => {
    await dbService.saveFlight(flug());
    expect(await dbService.getFlights()).toEqual([flug()]);
  });

  it('zählt beim ersten Speichern einen Akku-Zyklus', async () => {
    await dbService.saveBattery(akku());
    await dbService.saveFlight(flug({ batteryId: 'a1' }));
    expect(await zyklen()).toBe(6);
  });

  it('zählt keinen weiteren Zyklus, wenn derselbe Flug erneut gespeichert wird (Bilder, Track)', async () => {
    await dbService.saveBattery(akku());
    await dbService.saveFlight(flug({ batteryId: 'a1' }));
    await dbService.saveFlight(flug({ batteryId: 'a1', track: [{ t: 0, lat: 49.87, lon: 8.65 }] }));
    await dbService.saveFlight(flug({ batteryId: 'a1', notes: 'Bild ergänzt' }));
    expect(await zyklen()).toBe(6);
    expect((await dbService.getFlights())[0].notes).toBe('Bild ergänzt');
  });

  it('zählt den Zyklus beim neuen Akku, wenn am Flug ein anderer eingetragen wird', async () => {
    await dbService.saveBattery(akku());
    await dbService.saveBattery(akku({ id: 'a2', number: '2', cycles: 0 }));
    await dbService.saveFlight(flug({ batteryId: 'a1' }));
    await dbService.saveFlight(flug({ batteryId: 'a2' }));
    expect(await zyklen('a2')).toBe(1);
  });

  it('zählt je Flug genau einen Zyklus', async () => {
    await dbService.saveBattery(akku({ cycles: 0 }));
    await dbService.saveFlight(flug({ id: 'f1', batteryId: 'a1' }));
    await dbService.saveFlight(flug({ id: 'f2', batteryId: 'a1' }));
    expect(await zyklen()).toBe(2);
  });

  it('zählt ab 0, wenn beim Akku noch keine Zyklen stehen', async () => {
    await dbService.saveBattery(akku({ cycles: undefined as unknown as number }));
    await dbService.saveFlight(flug({ batteryId: 'a1' }));
    expect(await zyklen()).toBe(1);
  });

  it('speichert einen Flug auch dann, wenn der Akku nicht (mehr) existiert', async () => {
    await dbService.saveFlight(flug({ batteryId: 'geloescht' }));
    expect(await dbService.getFlights()).toHaveLength(1);
    expect(await dbService.getBatteries()).toEqual([]);
  });

  it('löscht einen Flug, ohne die Akku-Zyklen anzufassen', async () => {
    await dbService.saveBattery(akku());
    await dbService.saveFlight(flug({ batteryId: 'a1' }));
    await dbService.deleteFlight('f1');
    expect(await dbService.getFlights()).toEqual([]);
    expect(await zyklen()).toBe(6);
  });

  it('holt einen gelöschten Flug zurück, ohne den Zyklus ein zweites Mal zu zählen', async () => {
    await dbService.saveBattery(akku());
    const f = flug({ batteryId: 'a1' });
    await dbService.saveFlight(f);
    await dbService.deleteFlight(f.id);
    await dbService.restoreFlight(f);
    expect(await dbService.getFlights()).toEqual([f]);
    expect(await zyklen()).toBe(6);
  });
});

describe('Stammdaten', () => {
  it('speichert, liest und löscht Drohnen, Akkus und Piloten', async () => {
    const pilot: Pilot = { id: 'p1', name: 'Kim', eid: 'DEU-1', isGuest: false, createdAt: 1 };
    await dbService.saveDrone(drohne());
    await dbService.saveBattery(akku());
    await dbService.savePilot(pilot);
    expect(await dbService.getDrones()).toEqual([drohne()]);
    expect(await dbService.getBatteries()).toEqual([akku()]);
    expect(await dbService.getPilots()).toEqual([pilot]);

    await dbService.deleteDrone('d1');
    await dbService.deleteBattery('a1');
    await dbService.deletePilot('p1');
    expect(await dbService.getDrones()).toEqual([]);
    expect(await dbService.getBatteries()).toEqual([]);
    expect(await dbService.getPilots()).toEqual([]);
  });

  it('überschreibt beim Speichern mit gleicher id statt zu verdoppeln', async () => {
    await dbService.saveDrone(drohne());
    await dbService.saveDrone(drohne({ model: 'Mini 5 Pro' }));
    expect((await dbService.getDrones()).map(d => d.model)).toEqual(['Mini 5 Pro']);
  });

  it('liefert das Profil oder undefined, wenn noch keins angelegt ist', async () => {
    expect(await dbService.getProfile()).toBeUndefined();
    const profil: UserProfile = { id: 'main_profile', name: 'Kim', eid: 'DEU-1', licenseType: 'A2', insuranceNumber: 'V-1' };
    await dbService.saveProfile(profil);
    expect(await dbService.getProfile()).toEqual(profil);
  });

  it('filtert Wartungen nach Drohne', async () => {
    const w = (id: string, droneId: string): MaintenanceRecord =>
      ({ id, droneId, date: '2026-07-01', type: 'Propeller', description: 'neu', createdAt: 1 });
    await dbService.saveMaintenance(w('m1', 'd1'));
    await dbService.saveMaintenance(w('m2', 'd2'));
    expect((await dbService.getMaintenance('d1')).map(m => m.id)).toEqual(['m1']);
    expect(await dbService.getAllMaintenance()).toHaveLength(2);
    await dbService.deleteMaintenance('m1');
    expect(await dbService.getMaintenance('d1')).toEqual([]);
  });

  it('sortiert Flugpläne und Favoriten neueste zuerst', async () => {
    const plan = (id: string, createdAt: number): FlightPlan => ({ id, name: id, wegpunkte: [], createdAt });
    await dbService.saveFlightPlan(plan('alt', 1));
    await dbService.saveFlightPlan(plan('neu', 3));
    await dbService.saveFlightPlan(plan('mitte', 2));
    expect((await dbService.getFlightPlans()).map(p => p.id)).toEqual(['neu', 'mitte', 'alt']);
    await dbService.deleteFlightPlan('neu');
    expect(await dbService.getFlightPlans()).toHaveLength(2);

    const fav = (id: string, createdAt: number) => ({ id, name: id, locationName: id, coordinates: [0, 0] as [number, number], createdAt });
    await dbService.saveLocationFavorite(fav('a', 1));
    await dbService.saveLocationFavorite(fav('b', 2));
    expect((await dbService.getLocationFavorites()).map(f => f.id)).toEqual(['b', 'a']);
    await dbService.deleteLocationFavorite('b');
    expect((await dbService.getLocationFavorites()).map(f => f.id)).toEqual(['a']);
  });

  it('sortiert Kunden und Ersatzteile nach Namen', async () => {
    const kunde = (id: string, name: string): Customer => ({ id, name, createdAt: 1 });
    await dbService.saveCustomer(kunde('k1', 'Zimmerei Ost'));
    await dbService.saveCustomer(kunde('k2', 'Ärztehaus'));
    await dbService.saveCustomer(kunde('k3', 'Bauamt'));
    expect((await dbService.getCustomers()).map(k => k.name)).toEqual(['Ärztehaus', 'Bauamt', 'Zimmerei Ost']);
    await dbService.deleteCustomer('k1');
    expect(await dbService.getCustomers()).toHaveLength(2);

    const teil = (id: string, name: string): SparePart => ({ id, name, anzahl: 1, createdAt: 1 });
    await dbService.saveSparePart(teil('t1', 'Propeller'));
    await dbService.saveSparePart(teil('t2', 'Landegestell'));
    expect((await dbService.getSpareParts()).map(t => t.name)).toEqual(['Landegestell', 'Propeller']);
    await dbService.deleteSparePart('t1');
    expect((await dbService.getSpareParts()).map(t => t.id)).toEqual(['t2']);
  });

  it('legt Offline-Karten nach Regionscode und Zonen nach Land ab', async () => {
    const karte = { code: 'de-he', name: 'Hessen', blob: new Blob(['x']), groesse: 1, geladenAm: 1 };
    await dbService.saveMapRegion(karte);
    await dbService.saveMapRegion({ ...karte, name: 'Hessen (neu)' });
    expect((await dbService.getMapRegions()).map(k => k.name)).toEqual(['Hessen (neu)']);
    expect((await dbService.getMapRegion('de-he'))?.code).toBe('de-he');
    await dbService.deleteMapRegion('de-he');
    expect(await dbService.getMapRegion('de-he')).toBeUndefined();

    await dbService.saveEuZonen({ land: 'AUT', zonen: [], anzahl: 0, importiertAm: 1 });
    expect((await dbService.getEuZonen()).map(z => z.land)).toEqual(['AUT']);
    await dbService.deleteEuZonen('AUT');
    expect(await dbService.getEuZonen()).toEqual([]);
  });

  it('speichert und löscht Dokumente', async () => {
    await dbService.saveDocument({ id: 'doc1', name: 'Nachweis.pdf', type: 'application/pdf', data: new Blob(['%PDF']), createdAt: 1 });
    expect((await dbService.getDocuments()).map(d => d.name)).toEqual(['Nachweis.pdf']);
    await dbService.deleteDocument('doc1');
    expect(await dbService.getDocuments()).toEqual([]);
  });
});

describe('importAllData (Sicherung einspielen)', () => {
  const leer = { drones: [], flights: [], batteries: [], maintenance: [], pilots: [], profile: null, documents: [] };

  async function vorhandeneDaten() {
    await dbService.saveDrone(drohne({ id: 'alt' }));
    await dbService.saveFlight(flug({ id: 'alt' }));
    await dbService.saveFlightPlan({ id: 'plan-alt', name: 'Alt', wegpunkte: [], createdAt: 1 });
    await dbService.saveCustomer({ id: 'k-alt', name: 'Alt', createdAt: 1 });
    await dbService.saveProfile({ id: 'main_profile', name: 'Alt', eid: 'DEU-0', licenseType: 'A2', insuranceNumber: '' });
  }

  it('ergänzt im Modus „merge“ und überschreibt gleiche ids', async () => {
    await vorhandeneDaten();
    await dbService.importAllData({ ...leer, drones: [drohne({ id: 'alt', model: 'Neu' }), drohne({ id: 'neu' })] });
    expect((await dbService.getDrones()).map(d => `${d.id}:${d.model}`).sort()).toEqual(['alt:Neu', 'neu:Mini 4 Pro']);
    expect(await dbService.getFlights()).toHaveLength(1);
    expect((await dbService.getProfile())?.name).toBe('Alt');
  });

  it('ersetzt im Modus „replace“ alle Speicher aus der Datei', async () => {
    await vorhandeneDaten();
    await dbService.importAllData({
      ...leer,
      drones: [drohne({ id: 'neu' })],
      profile: { id: 'main_profile', name: 'Neu', eid: 'DEU-9', licenseType: 'A1/A3', insuranceNumber: '' },
      flightPlans: [], locationFavorites: [], customers: [], spareParts: [],
    }, 'replace');
    expect((await dbService.getDrones()).map(d => d.id)).toEqual(['neu']);
    expect(await dbService.getFlights()).toEqual([]);
    expect(await dbService.getFlightPlans()).toEqual([]);
    expect(await dbService.getCustomers()).toEqual([]);
    expect((await dbService.getProfile())?.name).toBe('Neu');
  });

  it('lässt beim Einspielen einer alten Sicherung (Format 1) die neueren Speicher stehen', async () => {
    await vorhandeneDaten();
    await dbService.importAllData({ ...leer, drones: [drohne({ id: 'neu' })] }, 'replace');
    expect((await dbService.getDrones()).map(d => d.id)).toEqual(['neu']);
    expect(await dbService.getFlights()).toEqual([]);
    // Nicht in der Datei → nicht geleert.
    expect((await dbService.getFlightPlans()).map(p => p.id)).toEqual(['plan-alt']);
    expect((await dbService.getCustomers()).map(k => k.id)).toEqual(['k-alt']);
  });

  it('leert im Modus „replace“ auch das Profil, wenn die Datei keins enthält', async () => {
    await vorhandeneDaten();
    await dbService.importAllData({ ...leer }, 'replace');
    expect(await dbService.getProfile()).toBeUndefined();
  });

  it('spielt alle backup-relevanten Speicher ein', async () => {
    await dbService.importAllData({
      drones: [drohne()],
      flights: [flug()],
      batteries: [akku()],
      maintenance: [{ id: 'm1', droneId: 'd1', date: '2026-07-01', type: 'Motor', description: 'x', createdAt: 1 }],
      pilots: [{ id: 'p1', name: 'Kim', eid: 'DEU-1', isGuest: false, createdAt: 1 }],
      profile: { id: 'main_profile', name: 'Kim', eid: 'DEU-1', licenseType: 'A2', insuranceNumber: '' },
      documents: [{ id: 'doc1', name: 'a.pdf', type: 'application/pdf', data: new Blob(['x']), createdAt: 1 }],
      flightPlans: [{ id: 'fp1', name: 'Runde', wegpunkte: [], createdAt: 1 }],
      locationFavorites: [{ id: 'lf1', name: 'Wiese', locationName: 'Wiese', coordinates: [0, 0], createdAt: 1 }],
      customers: [{ id: 'k1', name: 'Bauamt', createdAt: 1 }],
      spareParts: [{ id: 't1', name: 'Propeller', anzahl: 4, createdAt: 1 }],
    });
    expect(await dbService.getDrones()).toHaveLength(1);
    expect(await dbService.getFlights()).toHaveLength(1);
    expect(await dbService.getBatteries()).toHaveLength(1);
    expect(await dbService.getAllMaintenance()).toHaveLength(1);
    expect(await dbService.getPilots()).toHaveLength(1);
    expect(await dbService.getDocuments()).toHaveLength(1);
    expect(await dbService.getFlightPlans()).toHaveLength(1);
    expect(await dbService.getLocationFavorites()).toHaveLength(1);
    expect(await dbService.getCustomers()).toHaveLength(1);
    expect(await dbService.getSpareParts()).toHaveLength(1);
    expect((await dbService.getProfile())?.name).toBe('Kim');
  });

  it('zählt beim Einspielen keine Akku-Zyklen hoch', async () => {
    await dbService.importAllData({ ...leer, batteries: [akku()], flights: [flug({ batteryId: 'a1' })] });
    expect(await zyklen()).toBe(5);
  });

  it('fasst Offline-Karten und importierte Zonen nicht an', async () => {
    await dbService.saveMapRegion({ code: 'de-he', name: 'Hessen', blob: new Blob(['x']), groesse: 1, geladenAm: 1 });
    await dbService.saveEuZonen({ land: 'AUT', zonen: [], anzahl: 0, importiertAm: 1 });
    await dbService.importAllData({ ...leer, flightPlans: [], locationFavorites: [], customers: [], spareParts: [] }, 'replace');
    expect(await dbService.getMapRegions()).toHaveLength(1);
    expect(await dbService.getEuZonen()).toHaveLength(1);
  });
});
