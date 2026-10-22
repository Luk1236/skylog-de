// Wann zuletzt exportiert wurde. Bewusst in localStorage und NICHT in der
// Sicherungsdatei: der Zeitstempel beschreibt dieses Gerät, nicht die Daten.
// Läge er in der Datei, würde ein eingespieltes altes Backup die Erinnerung
// zurückdrehen und man hielte sich fälschlich für gesichert.
//
// Eigene kleine Datei, damit App und Logbuch für das Datum nicht die ganze
// Sicherungslogik (backup.ts samt Verschlüsselung) in den Erststart ziehen.
const LAST_BACKUP_KEY = 'skylog_last_backup_at';

export function getLastBackupAt(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function markBackupDone(): void {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
}
