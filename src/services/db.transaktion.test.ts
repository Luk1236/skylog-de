// Abläufe aus db.ts gegen eine echte IndexedDB-Umsetzung (fake-indexeddb):
// Upgrade einer alten Datenbank, Transaktionen und Zurückrollen. Der kleine
// Ersatz in db.test.ts kann genau das nicht prüfen.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { dbService, type Battery, type Drone, type Flight } from './db';

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
const leer = { drones: [], flights: [], batteries: [], maintenance: [], pilots: [], profile: null, documents: [] };

// Jeder Test bekommt eine frische, leere IndexedDB.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

/** Datenbank im Stand einer älteren App-Version anlegen (ohne db.ts). */
function alteDatenbank(version: number, stores: string[], fluege: Flight[] = []): Promise<void> {
  return new Promise((fertig, fehler) => {
    const anfrage = indexedDB.open('skylog_db_v3', version);
    anfrage.onupgradeneeded = () => {
      for (const s of stores) anfrage.result.createObjectStore(s, { keyPath: 'id' });
      for (const f of fluege) anfrage.transaction!.objectStore('flights').put(f);
    };
    anfrage.onsuccess = () => { anfrage.result.close(); fertig(); };
    anfrage.onerror = () => fehler(anfrage.error);
  });
}

describe('Upgrade einer bestehenden Datenbank', () => {
  it('hebt v7 auf v12 an, legt die neuen Speicher an und behält die Flüge', async () => {
    await alteDatenbank(7, ['drones', 'flights', 'documents', 'batteries', 'profile', 'maintenance', 'pilots', 'flightplans'], [flug()]);

    expect(await dbService.getFlights()).toEqual([flug()]);
    // Die neuen Speicher sind benutzbar – mit ihren eigenen Schlüsseln.
    await dbService.saveMapRegion({ code: 'de-he', name: 'Hessen', blob: new Blob(['x']), groesse: 1, geladenAm: 1 });
    await dbService.saveEuZonen({ land: 'AUT', zonen: [], anzahl: 0, importiertAm: 1 });
    await dbService.saveCustomer({ id: 'k1', name: 'Bauamt', createdAt: 1 });
    await dbService.saveSparePart({ id: 't1', name: 'Propeller', anzahl: 2, createdAt: 1 });
    expect((await dbService.getMapRegion('de-he'))?.name).toBe('Hessen');
    expect(await dbService.getEuZonen()).toHaveLength(1);
    expect(await dbService.getCustomers()).toHaveLength(1);
    expect(await dbService.getSpareParts()).toHaveLength(1);
  });
});

describe('saveFlight in einer Transaktion', () => {
  it('zählt bei gleichzeitig gespeicherten Flügen jeden Zyklus (kein verlorenes Update)', async () => {
    await dbService.saveBattery(akku({ cycles: 0 }));
    await Promise.all([
      dbService.saveFlight(flug({ id: 'f1', batteryId: 'a1' })),
      dbService.saveFlight(flug({ id: 'f2', batteryId: 'a1' })),
      dbService.saveFlight(flug({ id: 'f3', batteryId: 'a1' })),
    ]);
    expect((await dbService.getBatteries())[0].cycles).toBe(3);
    expect(await dbService.getFlights()).toHaveLength(3);
  });

  it('zählt beim erneuten Speichern desselben Flugs nicht noch einmal', async () => {
    await dbService.saveBattery(akku());
    await dbService.saveFlight(flug({ batteryId: 'a1' }));
    await dbService.saveFlight(flug({ batteryId: 'a1', notes: 'Track ergänzt' }));
    expect((await dbService.getBatteries())[0].cycles).toBe(6);
  });

  it('speichert weder Flug noch Zyklus, wenn der Flug nicht speicherbar ist', async () => {
    await dbService.saveBattery(akku());
    // Eine Funktion lässt sich nicht in IndexedDB ablegen (DataCloneError).
    const kaputt = { ...flug({ batteryId: 'a1' }), notes: (() => {}) as unknown as string };
    await expect(dbService.saveFlight(kaputt)).rejects.toThrow();
    expect(await dbService.getFlights()).toEqual([]);
    expect((await dbService.getBatteries())[0].cycles).toBe(5);
  });
});

describe('importAllData – Transaktion und Zurückrollen', () => {
  async function vorhandeneDaten() {
    await dbService.saveDrone(drohne({ id: 'alt' }));
    await dbService.saveFlight(flug({ id: 'alt' }));
    await dbService.saveFlightPlan({ id: 'plan-alt', name: 'Alt', wegpunkte: [], createdAt: 1 });
    await dbService.saveProfile({ id: 'main_profile', name: 'Alt', eid: 'DEU-0', licenseType: 'A2', insuranceNumber: '' });
  }
  async function bestand() {
    return {
      drohnen: (await dbService.getDrones()).map(d => d.id).sort(),
      fluege: (await dbService.getFlights()).map(f => f.id).sort(),
      plaene: (await dbService.getFlightPlans()).map(p => p.id),
      profil: (await dbService.getProfile())?.name,
    };
  }
  const vorher = { drohnen: ['alt'], fluege: ['alt'], plaene: ['plan-alt'], profil: 'Alt' };

  it('ersetzt bei Erfolg den kompletten Bestand', async () => {
    await vorhandeneDaten();
    await dbService.importAllData({
      ...leer,
      drones: [drohne({ id: 'neu' })],
      flights: [flug({ id: 'neu' })],
      profile: { id: 'main_profile', name: 'Neu', eid: 'DEU-9', licenseType: 'A1/A3', insuranceNumber: '' },
      flightPlans: [], locationFavorites: [], customers: [], spareParts: [],
    }, 'replace');
    expect(await bestand()).toEqual({ drohnen: ['neu'], fluege: ['neu'], plaene: [], profil: 'Neu' });
  });

  it('rollt „replace“ komplett zurück, wenn ein Datensatz ohne Schlüssel kommt', async () => {
    await vorhandeneDaten();
    const ohneId = { ...flug(), id: undefined } as unknown as Flight;
    await expect(dbService.importAllData({
      ...leer, drones: [drohne({ id: 'neu' })], flights: [flug({ id: 'neu' }), ohneId], flightPlans: [],
    }, 'replace')).rejects.toThrow();
    // Nichts geleert, nichts halb eingespielt.
    expect(await bestand()).toEqual(vorher);
  });

  it('rollt „replace“ zurück, wenn ein Datensatz nicht speicherbar ist', async () => {
    await vorhandeneDaten();
    const kaputt = { ...drohne({ id: 'neu' }), model: Symbol('x') as unknown as string };
    await expect(dbService.importAllData({ ...leer, drones: [kaputt] }, 'replace')).rejects.toThrow();
    expect(await bestand()).toEqual(vorher);
  });

  it('schreibt bei „merge“ mit fehlerhaftem Datensatz auch die gültigen nicht', async () => {
    await vorhandeneDaten();
    const ohneId = { ...drohne(), id: undefined } as unknown as Drone;
    await expect(dbService.importAllData({ ...leer, drones: [drohne({ id: 'neu' }), ohneId] })).rejects.toThrow();
    expect(await bestand()).toEqual(vorher);
  });

  it('bleibt nach einem abgebrochenen Import benutzbar', async () => {
    await vorhandeneDaten();
    const ohneId = { ...drohne(), id: undefined } as unknown as Drone;
    await expect(dbService.importAllData({ ...leer, drones: [ohneId] }, 'replace')).rejects.toThrow();
    await dbService.importAllData({ ...leer, drones: [drohne({ id: 'neu' })] });
    expect((await bestand()).drohnen).toEqual(['alt', 'neu']);
  });
});
