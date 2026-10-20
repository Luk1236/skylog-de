/**
 * NOAA Space Weather Prediction Center – Kp-Index (geomagnetischer Planetarindex).
 * Der Kp-Index (0–9) misst die globale geomagnetische Aktivität.
 * Hohe Werte (≥5) können GPS-Abfälle und Kompassstörungen bei Drohnen verursachen.
 */

export interface KpData {
  kpIndex: number;
  status: 'quiet' | 'unsettled' | 'active' | 'minor_storm' | 'major_storm';
  label: string;
  color: string;
  gpsWarning: boolean;
  source: 'live' | 'fallback';
}

function kpToStatus(kp: number): KpData['status'] {
  if (kp < 2) return 'quiet';
  if (kp < 4) return 'unsettled';
  if (kp < 5) return 'active';
  if (kp < 7) return 'minor_storm';
  return 'major_storm';
}

function kpToLabel(kp: number): string {
  if (kp < 2) return `Ruhig (Kp ${kp})`;
  if (kp < 4) return `Leicht bewegt (Kp ${kp})`;
  if (kp < 5) return `Erhöhte Aktivität (Kp ${kp})`;
  if (kp < 7) return `Kleiner Sonnensturm (Kp ${kp}) ⚠️`;
  return `Starker Sonnensturm (Kp ${kp}) 🔴`;
}

// Textfarben nach DESIGN.md (helle Flaechen; der Dunkelmodus hellt sie selbst auf).
function kpToColor(kp: number): string {
  if (kp < 2) return 'text-brand-green';
  if (kp < 4) return 'text-brand-blue';
  if (kp < 5) return 'text-amber-700';
  if (kp < 7) return 'text-brand-orange';
  return 'text-brand-red';
}

/** Ruft den aktuellen Kp-Index von der NOAA SWPC API ab.
 *  Falls die API nicht erreichbar ist (kein Internet / CORS), wird ein
 *  ruhiger Fallback-Wert zurückgegeben, damit die App offline funktioniert.
 */
export async function fetchKpIndex(): Promise<KpData> {
  try {
    // NOAA Planetary K-Index – 1-Minuten-Auflösung, letzter Wert
    const res = await fetch(
      'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error('NOAA API error');
    const json: Array<Array<string | number>> = await res.json();
    // Letzter Eintrag, Index 1 = Kp-Wert (als String oder Zahl)
    const latest = json[json.length - 1];
    const kp = parseFloat(String(latest?.[1] ?? '2'));
    const rounded = isNaN(kp) ? 2 : Math.round(kp * 10) / 10;
    const status = kpToStatus(rounded);
    return {
      kpIndex: rounded,
      status,
      label: kpToLabel(rounded),
      color: kpToColor(rounded),
      gpsWarning: rounded >= 4,
      source: 'live',
    };
  } catch {
    return {
      kpIndex: 2,
      status: 'unsettled',
      label: 'Ruhig (Kp 2) — Offline',
      color: 'text-brand-blue',
      gpsWarning: false,
      source: 'fallback',
    };
  }
}
