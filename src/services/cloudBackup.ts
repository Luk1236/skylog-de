import { exportBackup } from './backup';

const AUTO_BACKUP_ENABLED_KEY = 'skylog_autobackup_enabled_v1';
const AUTO_BACKUP_INTERVAL_KEY = 'skylog_autobackup_interval_v1';
const LAST_BACKUP_TIME_KEY = 'skylog_last_backup_time_v1';

export interface AutoBackupConfig {
  enabled: boolean;
  intervalDays: number;
  lastBackupTime: number | null;
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function getAutoBackupConfig(): AutoBackupConfig {
  const storage = getStorage();
  if (!storage) {
    return { enabled: false, intervalDays: 7, lastBackupTime: null };
  }
  const enabled = storage.getItem(AUTO_BACKUP_ENABLED_KEY) === 'true';
  const intervalDays = parseInt(storage.getItem(AUTO_BACKUP_INTERVAL_KEY) || '7', 10);
  const lastTimeStr = storage.getItem(LAST_BACKUP_TIME_KEY);
  const lastBackupTime = lastTimeStr ? parseInt(lastTimeStr, 10) : null;

  return { enabled, intervalDays, lastBackupTime };
}

export function saveAutoBackupConfig(enabled: boolean, intervalDays: number): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(AUTO_BACKUP_ENABLED_KEY, enabled ? 'true' : 'false');
    storage.setItem(AUTO_BACKUP_INTERVAL_KEY, intervalDays.toString());
  }
}

export function recordBackupPerformed(): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(LAST_BACKUP_TIME_KEY, Date.now().toString());
  }
}

export function shouldTriggerAutoBackup(): boolean {
  const config = getAutoBackupConfig();
  if (!config.enabled) return false;
  if (!config.lastBackupTime) return true;

  const elapsedMs = Date.now() - config.lastBackupTime;
  const intervalMs = config.intervalDays * 24 * 60 * 60 * 1000;

  return elapsedMs >= intervalMs;
}

export async function performCloudBackupExport(): Promise<void> {
  await exportBackup();
  recordBackupPerformed();
}
