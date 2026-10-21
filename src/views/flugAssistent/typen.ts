// Gemeinsame Typen und Helfer der Flug-Assistent-Schritte.

/** Ein Flugabschnitt zwischen Start und Landung; duration in Sekunden. */
export interface Abschnitt {
  startTime: number;
  endTime: number;
  duration: number;
}

/** Wetterwerte im Assistenten - vorbelegt aus open-meteo, von Hand änderbar. */
export interface AssistentWetter {
  temp: number;
  windSpeed: number;
  windSpeed120: number;
  windGusts: number;
  visibility: string;
  kIndex: number;
  condition: string;
}

/** Antwort der KI-Sicherheitsanalyse (api/safety-check). */
export interface KiAnalyse {
  obstacles: { type: string; severity: 'Low' | 'Medium' | 'High'; description: string; action: string }[];
  overall_safety_score: number;
  summary: string;
}

/** Sekunden als m:ss, z. B. 65 → „1:05“. */
export function formatZeit(sekunden: number): string {
  const min = Math.floor(sekunden / 60);
  const sek = sekunden % 60;
  return `${min}:${sek.toString().padStart(2, '0')}`;
}

/** Gesamtdauer aller Abschnitte in Sekunden. */
export function summeSekunden(abschnitte: Abschnitt[]): number {
  return abschnitte.reduce((summe, a) => summe + a.duration, 0);
}
