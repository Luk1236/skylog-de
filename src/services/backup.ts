import {
  dbService,
  type Drone,
  type Flight,
  type Battery,
  type UserProfile,
  type MaintenanceRecord,
  type Pilot,
  type AppDocument,
} from './db';

// Serialised backup file format. Documents store their binary as base64,
// because Blobs cannot be represented directly in JSON.
export interface BackupData {
  app: 'SkyLog DE';
  version: number;
  exportedAt: string;
  drones: Drone[];
  flights: Flight[];
  batteries: Battery[];
  maintenance: MaintenanceRecord[];
  pilots: Pilot[];
  profile: UserProfile | null;
  documents: { id: string; name: string; type: string; createdAt: number; dataBase64: string }[];
}

export interface ImportResult {
  drones: number;
  flights: number;
  batteries: number;
  maintenance: number;
  pilots: number;
  documents: number;
  profile: boolean;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(((reader.result as string) || '').split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, type: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// Reads every store and downloads a single .json backup file.
export async function exportBackup(): Promise<void> {
  const [drones, flights, batteries, maintenance, pilots, profile, documents] = await Promise.all([
    dbService.getDrones(),
    dbService.getFlights(),
    dbService.getBatteries(),
    dbService.getAllMaintenance(),
    dbService.getPilots(),
    dbService.getProfile(),
    dbService.getDocuments(),
  ]);

  const serialisedDocs = await Promise.all(
    documents.map(async (d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      createdAt: d.createdAt,
      dataBase64: await blobToBase64(d.data),
    }))
  );

  const data: BackupData = {
    app: 'SkyLog DE',
    version: 1,
    exportedAt: new Date().toISOString(),
    drones,
    flights,
    batteries,
    maintenance,
    pilots,
    profile: profile ?? null,
    documents: serialisedDocs,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skylog_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Reads a backup file and merges its contents back into the DB (put by id).
export async function importBackup(file: File): Promise<ImportResult> {
  let data: BackupData;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Diese Datei ist keine gültige Sicherung (kein JSON).');
  }

  if (data.app !== 'SkyLog DE' || !Array.isArray(data.drones)) {
    throw new Error('Das ist keine SkyLog-DE-Sicherungsdatei.');
  }

  const documents: AppDocument[] = (data.documents ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    createdAt: d.createdAt,
    data: base64ToBlob(d.dataBase64, d.type),
  }));

  await dbService.importAllData({
    drones: data.drones ?? [],
    flights: data.flights ?? [],
    batteries: data.batteries ?? [],
    maintenance: data.maintenance ?? [],
    pilots: data.pilots ?? [],
    profile: data.profile ?? null,
    documents,
  });

  return {
    drones: data.drones?.length ?? 0,
    flights: data.flights?.length ?? 0,
    batteries: data.batteries?.length ?? 0,
    maintenance: data.maintenance?.length ?? 0,
    pilots: data.pilots?.length ?? 0,
    documents: documents.length,
    profile: !!data.profile,
  };
}
