import type { WeatherData } from './weather';
import type { Battery, UserProfile, Drone } from './db';

export interface SafetyCheckResult {
  score: number; // 0 - 100
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
  items: {
    id: string;
    title: string;
    status: 'pass' | 'warn' | 'fail';
    detail: string;
  }[];
}

export function calculatePreFlightSafetyScore(
  weather: WeatherData | null,
  drone: Drone | null,
  battery: Battery | null,
  profile: UserProfile | null,
  kpIndex: number = 2
): SafetyCheckResult {
  const items: SafetyCheckResult['items'] = [];
  let score = 100;

  // 1. Wind & Gusts
  const maxWind = drone?.maxWindSpeed || 35;
  const wind120 = weather?.windSpeed120 || weather?.windSpeed || 0;
  if (wind120 > maxWind) {
    score -= 30;
    items.push({
      id: 'wind',
      title: 'Windgeschwindigkeit in 120m Höhe',
      status: 'fail',
      detail: `Wind (${wind120} km/h) übersteigt die Drohnen-Herstellergrenze (${maxWind} km/h). Riskant!`,
    });
  } else if (wind120 > maxWind * 0.75) {
    score -= 15;
    items.push({
      id: 'wind',
      title: 'Windgeschwindigkeit in 120m Höhe',
      status: 'warn',
      detail: `Wind (${wind120} km/h) liegt nahe am Maximum (${maxWind} km/h). Auf Böen achten.`,
    });
  } else {
    items.push({
      id: 'wind',
      title: 'Wind & Böen (120m)',
      status: 'pass',
      detail: `Wind mit ${wind120} km/h im grünen Bereich (Max: ${maxWind} km/h).`,
    });
  }

  // 2. Solar Storm / Kp Index (GPS Störung)
  if (kpIndex >= 6) {
    score -= 35;
    items.push({
      id: 'kp',
      title: 'Geomagnetischer Kp-Index (GPS)',
      status: 'fail',
      detail: `Starker Sonnensturm (Kp ${kpIndex}). Hohe Gefahr von GPS-Abfällen & Kompass-Störungen!`,
    });
  } else if (kpIndex >= 4) {
    score -= 15;
    items.push({
      id: 'kp',
      title: 'Geomagnetischer Kp-Index (GPS)',
      status: 'warn',
      detail: `Erhöhte Sonnenaktivität (Kp ${kpIndex}). GPS-Genauigkeit genau beobachten.`,
    });
  } else {
    items.push({
      id: 'kp',
      title: 'Geomagnetischer Kp-Index (GPS)',
      status: 'pass',
      detail: `Ruhiges Weltraumwetter (Kp ${kpIndex}). Ungestörter GPS-Empfang zu erwarten.`,
    });
  }

  // 3. Temperatur (Akku-Leistung)
  const temp = weather?.temp ?? 20;
  if (temp < 0 || temp > 42) {
    score -= 25;
    items.push({
      id: 'temp',
      title: 'Umgebungstemperatur',
      status: 'fail',
      detail: `Extremtemperatur (${temp}°C). Starker Akku-Spannungsabfall droht!`,
    });
  } else if (temp < 8) {
    score -= 10;
    items.push({
      id: 'temp',
      title: 'Umgebungstemperatur',
      status: 'warn',
      detail: `Niedrige Temperatur (${temp}°C). Akkus vor dem Start vorwärmen.`,
    });
  } else {
    items.push({
      id: 'temp',
      title: 'Umgebungstemperatur',
      status: 'pass',
      detail: `Optimaler Bereich (${temp}°C).`,
    });
  }

  // 4. Akku-Gesundheit (SOH)
  if (battery) {
    const soh = battery.health ?? 100;
    if (soh < 60) {
      score -= 30;
      items.push({
        id: 'battery',
        title: 'Akku-Zustand (SOH)',
        status: 'fail',
        detail: `Akku-Gesundheit kritisch low (${soh}% SOH). Akku aussondern!`,
      });
    } else if (soh < 80) {
      score -= 15;
      items.push({
        id: 'battery',
        title: 'Akku-Zustand (SOH)',
        status: 'warn',
        detail: `Akku-Gesundheit bei ${soh}% SOH. Flugzeiten reduzieren.`,
      });
    } else {
      items.push({
        id: 'battery',
        title: 'Akku-Zustand (SOH)',
        status: 'pass',
        detail: `Akku in hervorragendem Zustand (${soh}% SOH).`,
      });
    }
  }

  // 5. Pilotenlizenz
  if (profile) {
    if (profile.licenseType === 'None') {
      score -= 10;
      items.push({
        id: 'license',
        title: 'Fernpiloten-Nachweis',
        status: 'warn',
        detail: 'Kein Führerschein angegeben (Nur Open A1/A3 C0/Legacy <250g erlaubt).',
      });
    } else {
      items.push({
        id: 'license',
        title: 'Fernpiloten-Nachweis',
        status: 'pass',
        detail: `Gültiger Nachweis (${profile.licenseType}) eingetragen.`,
      });
    }
  }

  score = Math.max(0, Math.min(100, score));
  let status: SafetyCheckResult['status'] = 'SAFE';
  if (score < 60 || items.some(i => i.status === 'fail')) {
    status = 'CRITICAL';
  } else if (score < 85 || items.some(i => i.status === 'warn')) {
    status = 'WARNING';
  }

  return { score, status, items };
}
