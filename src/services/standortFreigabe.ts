// Darf die App den Standort abfragen? Vorher kam die Browser-Abfrage gleich
// beim Start - noch vor der Begrüßung und ohne ein Wort, wofür. Jetzt erklärt
// erst ein Hinweis auf der Karte den Zweck; die Abfrage folgt auf den Tipp.

export type StandortFreigabe = 'offen' | 'erlaubt' | 'abgelehnt';

const KEY = 'skylog_standort_freigabe';

export function ladeStandortFreigabe(): StandortFreigabe {
  try {
    const wert = localStorage.getItem(KEY);
    return wert === 'erlaubt' || wert === 'abgelehnt' ? wert : 'offen';
  } catch {
    return 'offen';
  }
}

export function speichereStandortFreigabe(wert: Exclude<StandortFreigabe, 'offen'>): void {
  try {
    localStorage.setItem(KEY, wert);
  } catch {
    // Speicher gesperrt (privates Fenster) - gilt dann nur für diese Sitzung.
  }
}

/** Hat der Browser den Standort schon freigegeben (z. B. von früher)? Dann
 *  braucht es keinen Hinweis. Ohne Permissions-API: false. */
export async function standortSchonFreigegeben(): Promise<boolean> {
  try {
    if (!navigator.permissions?.query) return false;
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return false;
  }
}
