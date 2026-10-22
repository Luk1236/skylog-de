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
import { lokalesDatum } from '../lib/utils';
import { markBackupDone } from './sicherungsStand';

// Das Datum der letzten Sicherung liegt in einer eigenen kleinen Datei (siehe dort).
export { getLastBackupAt } from './sicherungsStand';

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

/** Teile der Sicherung, die sich so nicht speichern lassen. */
export interface Schaden { de: string; en: string; anzahl: number }

/** Die Sicherung enthält Einträge ohne gültige ID (oder keine Liste, wo eine
 *  stehen muss). Wird geworfen, BEVOR etwas an der Datenbank passiert. */
export class BeschaedigteSicherungFehler extends Error {
  readonly textEn: string;
  constructor(readonly schaeden: Schaden[]) {
    const anzahl = schaeden.reduce((s, x) => s + x.anzahl, 0);
    super(`Die Sicherung ist beschädigt: ${anzahl} ${anzahl === 1 ? 'Eintrag' : 'Einträge'} lassen sich nicht lesen `
      + `(${schaeden.map(x => x.de).join(', ')}). Es wurde nichts verändert.`);
    this.textEn = `The backup is damaged: ${anzahl} ${anzahl === 1 ? 'entry' : 'entries'} cannot be read `
      + `(${schaeden.map(x => x.en).join(', ')}). Nothing was changed.`;
    this.name = 'BeschaedigteSicherungFehler';
  }
}

const LISTEN: { feld: keyof BackupData; de: string; en: string; pflicht: boolean }[] = [
  { feld: 'drones', de: 'Drohnen', en: 'drones', pflicht: true },
  { feld: 'flights', de: 'Flüge', en: 'flights', pflicht: false },
  { feld: 'batteries', de: 'Akkus', en: 'batteries', pflicht: false },
  { feld: 'maintenance', de: 'Wartungen', en: 'maintenance', pflicht: false },
  { feld: 'pilots', de: 'Piloten', en: 'pilots', pflicht: false },
  { feld: 'documents', de: 'Dokumente', en: 'documents', pflicht: false },
  { feld: 'flightPlans', de: 'Flugpläne', en: 'flight plans', pflicht: false },
  { feld: 'locationFavorites', de: 'Lieblingsorte', en: 'favourite places', pflicht: false },
  { feld: 'customers', de: 'Kunden', en: 'customers', pflicht: false },
  { feld: 'spareParts', de: 'Ersatzteile', en: 'spare parts', pflicht: false },
];

const hatId = (x: unknown): boolean => {
  if (typeof x !== 'object' || x === null) return false;
  const id = (x as { id?: unknown }).id;
  return (typeof id === 'string' && id !== '') || (typeof id === 'number' && Number.isFinite(id));
};

/** Sucht Einträge, an denen das Einspielen scheitern würde. IndexedDB wirft
 *  sonst mitten im Schreiben - die Prüfung vorab sagt genau, was kaputt ist. */
export function findeSchaeden(data: BackupData): Schaden[] {
  const schaeden: Schaden[] = [];
  for (const { feld, de, en, pflicht } of LISTEN) {
    const wert = data[feld] as unknown;
    if (wert == null && !pflicht) continue;
    if (!Array.isArray(wert)) {
      schaeden.push({ de: `${de}: keine Liste`, en: `${en}: not a list`, anzahl: 1 });
      continue;
    }
    const kaputt = wert.filter(x => !hatId(x)).length;
    if (kaputt) schaeden.push({ de, en, anzahl: kaputt });
  }
  if (data.profile != null && !hatId(data.profile)) schaeden.push({ de: 'Profil', en: 'profile', anzahl: 1 });
  return schaeden;
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

// Formatversion der Sicherungsdatei. Hochzählen, sobald sich die Struktur
// so ändert, dass ältere App-Versionen sie nicht mehr korrekt lesen können.
// 2: zusaetzlich Flugplaene, Standort-Favoriten, Kunden und Ersatzteile.
export const BACKUP_VERSION = 2;

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

  const datum = lokalesDatum();
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

/** Liest eine Sicherungsdatei und prüft sie, ohne etwas zu verändern - für die
 *  Vorschau vor dem Ersetzen. Wirft dieselben Fehler wie importBackup. */
export async function leseSicherung(file: File, passwort?: string): Promise<BackupData> {
  const data = await leseBackupText(await file.text(), passwort);
  pruefeSicherung(data);
  return data;
}

/** Überblick über eine Sicherung für die Rückfrage vor dem Ersetzen. */
export interface SicherungsInhalt {
  drohnen: number;
  fluege: number;
  akkus: number;
  wartungen: number;
  piloten: number;
  dokumente: number;
  /** Flugpläne, Lieblingsorte, Kunden und Ersatzteile zusammen. */
  weitere: number;
  profil: boolean;
  /** Ältester und neuester Flug (YYYY-MM-DD), wenn es Flüge gibt. */
  von?: string;
  bis?: string;
  /** Wann die Sicherung erstellt wurde (ISO), wenn die Datei es sagt. */
  erstellt?: string;
}

export function beschreibeSicherung(data: BackupData): SicherungsInhalt {
  const daten = (data.flights ?? []).map(f => f.date).filter((d): d is string => typeof d === 'string' && d !== '').sort();
  return {
    drohnen: data.drones?.length ?? 0,
    fluege: data.flights?.length ?? 0,
    akkus: data.batteries?.length ?? 0,
    wartungen: data.maintenance?.length ?? 0,
    piloten: data.pilots?.length ?? 0,
    dokumente: data.documents?.length ?? 0,
    weitere: (data.flightPlans?.length ?? 0) + (data.locationFavorites?.length ?? 0)
      + (data.customers?.length ?? 0) + (data.spareParts?.length ?? 0),
    profil: !!data.profile,
    von: daten[0],
    bis: daten[daten.length - 1],
    erstellt: typeof data.exportedAt === 'string' ? data.exportedAt : undefined,
  };
}

/** Sicherheitskopie der aktuellen Daten, bevor eine Sicherung sie ersetzt (Idee E19):
 *  ein Fehlgriff beim Einspielen kostet dann nichts. Gibt den Dateinamen zurück. */
export async function sichereVorDemErsetzen(): Promise<string> {
  const { text } = await erstelleBackupText();
  const dateiname = `skylog_vor_wiederherstellung_${lokalesDatum()}.json`;
  await speichereDatei(dateiname, text);
  return dateiname;
}

function pruefeSicherung(data: BackupData): void {
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

  const schaeden = findeSchaeden(data);
  if (schaeden.length) throw new BeschaedigteSicherungFehler(schaeden);
}

// Reads a backup file and merges its contents back into the DB (put by id).
export async function importBackup(
  file: File,
  modus: 'merge' | 'replace' = 'merge',
  passwort?: string,
): Promise<ImportResult> {
  const data = await leseBackupText(await file.text(), passwort);
  // Erst prüfen, dann schreiben: Beim Ersetzen wird die Datenbank geleert.
  pruefeSicherung(data);

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
