import {
  dbService,
  type Drone,
  type Flight,
  type Battery,
  type UserProfile,
  type MaintenanceRecord,
  type Pilot,
  type AppDocument,
  type FlightPlan,
  type LocationFavorite,
  type Customer,
  type SparePart,
} from './db';
import { verschluessele, entschluessele, istVerschluesselt } from './backupCrypto';
import { speichereDatei } from '../lib/dateiAusgabe';

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
  // ab Format 2
  flightPlans?: FlightPlan[];
  locationFavorites?: LocationFavorite[];
  customers?: Customer[];
  spareParts?: SparePart[];
}

/** Die Datei ist verschlüsselt und es wurde (noch) kein Passwort angegeben. */
export class PasswortNoetigFehler extends Error {
  constructor() {
    super('Diese Sicherung ist mit einem Passwort verschlüsselt.');
    this.name = 'PasswortNoetigFehler';
  }
}

export interface ImportResult {
  drones: number;
  flights: number;
  batteries: number;
  maintenance: number;
  pilots: number;
  documents: number;
  profile: boolean;
  weitere: number;
}

// Wann zuletzt exportiert wurde. Bewusst in localStorage und NICHT in der
// Sicherungsdatei: der Zeitstempel beschreibt dieses Gerät, nicht die Daten.
// Läge er in der Datei, würde ein eingespieltes altes Backup die Erinnerung
// zurückdrehen und man hielte sich fälschlich für gesichert.
const LAST_BACKUP_KEY = 'skylog_last_backup_at';

// Formatversion der Sicherungsdatei. Hochzählen, sobald sich die Struktur
// so ändert, dass ältere App-Versionen sie nicht mehr korrekt lesen können.
// 2: zusaetzlich Flugplaene, Standort-Favoriten, Kunden und Ersatzteile.
export const BACKUP_VERSION = 2;

export function getLastBackupAt(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function markBackupDone(): void {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
}

/** Entfernt Zugangsdaten aus dem Profil, bevor es in die Sicherungsdatei
 *  geschrieben wird. Die FAA-NOTAM-Credentials sind Geheimnisse: wer eine
 *  Sicherung weitergibt oder in eine Cloud legt, wuerde sie sonst mitgeben.
 *  Preis dafuer: nach einer Wiederherstellung muessen sie neu eingetragen
 *  werden. Das ist der guenstigere Tausch. */
export function ohneZugangsdaten(profile: UserProfile | null): UserProfile | null {
  if (!profile) return null;
  const { notamClientId: _id, notamClientSecret: _secret, ...rest } = profile;
  return rest as UserProfile;
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

// Liest alle Speicher und baut den Inhalt der Sicherungsdatei.
export async function erstelleBackupText(passwort?: string): Promise<{ text: string; dateiname: string }> {
  const [drones, flights, batteries, maintenance, pilots, profile, documents,
    flightPlans, locationFavorites, customers, spareParts] = await Promise.all([
    dbService.getDrones(),
    dbService.getFlights(),
    dbService.getBatteries(),
    dbService.getAllMaintenance(),
    dbService.getPilots(),
    dbService.getProfile(),
    dbService.getDocuments(),
    dbService.getFlightPlans(),
    dbService.getLocationFavorites(),
    dbService.getCustomers(),
    dbService.getSpareParts(),
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
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    drones,
    flights,
    batteries,
    maintenance,
    pilots,
    profile: ohneZugangsdaten(profile ?? null),
    documents: serialisedDocs,
    flightPlans,
    locationFavorites,
    customers,
    spareParts,
  };

  const datum = new Date().toISOString().split('T')[0];
  const klar = JSON.stringify(data, null, 2);
  if (!passwort) return { text: klar, dateiname: `skylog_backup_${datum}.json` };
  const verschluesselt = await verschluessele(klar, passwort);
  return { text: JSON.stringify(verschluesselt), dateiname: `skylog_backup_${datum}_verschluesselt.json` };
}

// Erstellt die Sicherung und gibt sie aus: im Browser als Download, in der
// Android-App ueber das Teilen-Menue (Drive, Nextcloud, Dateien, Mail …).
export async function exportBackup(passwort?: string): Promise<void> {
  const { text, dateiname } = await erstelleBackupText(passwort);
  await speichereDatei(dateiname, text);
  markBackupDone();
}

/** Liest den Dateiinhalt; entschluesselt bei Bedarf. Wirft PasswortNoetigFehler,
 *  wenn die Datei verschluesselt ist und kein Passwort angegeben wurde. */
export async function leseBackupText(text: string, passwort?: string): Promise<BackupData> {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    throw new Error('Diese Datei ist keine gültige Sicherung (kein JSON).');
  }
  if (istVerschluesselt(roh)) {
    if (!passwort) throw new PasswortNoetigFehler();
    roh = JSON.parse(await entschluessele(roh, passwort));
  }
  return roh as BackupData;
}

// Reads a backup file and merges its contents back into the DB (put by id).
export async function importBackup(
  file: File,
  modus: 'merge' | 'replace' = 'merge',
  passwort?: string,
): Promise<ImportResult> {
  const data = await leseBackupText(await file.text(), passwort);

  if (data.app !== 'SkyLog DE' || !Array.isArray(data.drones)) {
    throw new Error('Das ist keine SkyLog-DE-Sicherungsdatei.');
  }

  // Die Datei nennt ihre Formatversion. Ist sie neuer als das, was diese
  // App-Version versteht, brechen wir lieber ab, statt Felder stillschweigend
  // zu verschlucken.
  if (typeof data.version === 'number' && data.version > BACKUP_VERSION) {
    throw new Error(
      `Diese Sicherung stammt aus einer neueren SkyLog-Version (Format ${data.version}, ` +
      `diese App kann ${BACKUP_VERSION}). Bitte die App aktualisieren.`
    );
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
    flightPlans: data.flightPlans,
    locationFavorites: data.locationFavorites,
    customers: data.customers,
    spareParts: data.spareParts,
  }, modus);

  return {
    drones: data.drones?.length ?? 0,
    flights: data.flights?.length ?? 0,
    batteries: data.batteries?.length ?? 0,
    maintenance: data.maintenance?.length ?? 0,
    pilots: data.pilots?.length ?? 0,
    documents: documents.length,
    profile: !!data.profile,
    weitere: (data.flightPlans?.length ?? 0) + (data.locationFavorites?.length ?? 0)
      + (data.customers?.length ?? 0) + (data.spareParts?.length ?? 0),
  };
}
