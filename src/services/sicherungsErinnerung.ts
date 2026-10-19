// Wie oft an eine Sicherung erinnert werden soll.
//
// Ersetzt das frühere „Auto Cloud-Backup": dessen Schalter hat nie etwas
// ausgelöst, und eine App ohne Server kann auch nicht heimlich in eine Cloud
// sichern. Ehrlich ist: Die App erinnert zuverlässig (Hinweis + auf Android
// eine Benachrichtigung), der Export selbst bleibt ein Fingertipp.

const INTERVALL_KEY = 'skylog_sicherung_intervall_tage';
export const INTERVALL_OPTIONEN = [7, 14, 30, 60] as const;
export const STANDARD_INTERVALL = 30;

export function getSicherungsIntervall(): number {
  try {
    const n = Number(localStorage.getItem(INTERVALL_KEY));
    return (INTERVALL_OPTIONEN as readonly number[]).includes(n) ? n : STANDARD_INTERVALL;
  } catch {
    return STANDARD_INTERVALL;
  }
}

export function setSicherungsIntervall(tage: number): void {
  if (!(INTERVALL_OPTIONEN as readonly number[]).includes(tage)) return;
  try {
    localStorage.setItem(INTERVALL_KEY, String(tage));
  } catch { /* Speicher nicht verfügbar - dann bleibt der Standard */ }
}
