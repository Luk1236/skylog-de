import type { WeatherData } from './weather';
import type { Battery, UserProfile, Drone } from './db';

export interface SafetyCheckItem {
  id: string;
  title: string;
  titleEn: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  detailEn: string;
}

export interface SafetyCheckResult {
  score: number; // 0 - 100
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
  items: SafetyCheckItem[];
}

export function calculatePreFlightSafetyScore(
  weather: WeatherData | null,
  drone: Drone | null,
  battery: Battery | null,
  profile: UserProfile | null,
  kpIndex: number = 2
): SafetyCheckResult {
  const items: SafetyCheckItem[] = [];
  let score = 100;
  // Jeder Prüfpunkt auf Deutsch und Englisch - die Oberfläche wählt nach Sprache.
  const punkt = (id: string, status: SafetyCheckItem['status'], title: [string, string], detail: [string, string]) => {
    items.push({ id, status, title: title[0], titleEn: title[1], detail: detail[0], detailEn: detail[1] });
  };

  // 1. Wind & Gusts
  const maxWind = drone?.maxWindSpeed || 35;
  const wind120 = weather?.windSpeed120 || weather?.windSpeed || 0;
  if (wind120 > maxWind) {
    score -= 30;
    punkt('wind', 'fail', ['Windgeschwindigkeit in 120 m Höhe', 'Wind speed at 120 m'], [
      `Wind (${wind120} km/h) übersteigt die Drohnen-Herstellergrenze (${maxWind} km/h). Riskant!`,
      `Wind (${wind120} km/h) exceeds the manufacturer limit of the drone (${maxWind} km/h). Risky!`,
    ]);
  } else if (wind120 > maxWind * 0.75) {
    score -= 15;
    punkt('wind', 'warn', ['Windgeschwindigkeit in 120 m Höhe', 'Wind speed at 120 m'], [
      `Wind (${wind120} km/h) liegt nahe am Maximum (${maxWind} km/h). Auf Böen achten.`,
      `Wind (${wind120} km/h) is close to the maximum (${maxWind} km/h). Watch out for gusts.`,
    ]);
  } else {
    punkt('wind', 'pass', ['Wind & Böen (120 m)', 'Wind & gusts (120 m)'], [
      `Wind mit ${wind120} km/h im grünen Bereich (Max: ${maxWind} km/h).`,
      `Wind at ${wind120} km/h is within limits (max: ${maxWind} km/h).`,
    ]);
  }

  // 2. Solar Storm / Kp Index (GPS Störung)
  const kpTitel: [string, string] = ['Geomagnetischer Kp-Index (GPS)', 'Geomagnetic Kp index (GPS)'];
  if (kpIndex >= 6) {
    score -= 35;
    punkt('kp', 'fail', kpTitel, [
      `Starker Sonnensturm (Kp ${kpIndex}). Hohe Gefahr von GPS-Abfällen & Kompass-Störungen!`,
      `Strong solar storm (Kp ${kpIndex}). High risk of GPS dropouts & compass interference!`,
    ]);
  } else if (kpIndex >= 4) {
    score -= 15;
    punkt('kp', 'warn', kpTitel, [
      `Erhöhte Sonnenaktivität (Kp ${kpIndex}). GPS-Genauigkeit genau beobachten.`,
      `Increased solar activity (Kp ${kpIndex}). Keep a close eye on GPS accuracy.`,
    ]);
  } else {
    punkt('kp', 'pass', kpTitel, [
      `Ruhiges Weltraumwetter (Kp ${kpIndex}). Ungestörter GPS-Empfang zu erwarten.`,
      `Quiet space weather (Kp ${kpIndex}). Undisturbed GPS reception expected.`,
    ]);
  }

  // 3. Temperatur (Akku-Leistung)
  const temp = weather?.temp ?? 20;
  const tempTitel: [string, string] = ['Umgebungstemperatur', 'Ambient temperature'];
  if (temp < 0 || temp > 42) {
    score -= 25;
    punkt('temp', 'fail', tempTitel, [
      `Extremtemperatur (${temp}°C). Starker Akku-Spannungsabfall droht!`,
      `Extreme temperature (${temp}°C). Severe battery voltage drop likely!`,
    ]);
  } else if (temp < 8) {
    score -= 10;
    punkt('temp', 'warn', tempTitel, [
      `Niedrige Temperatur (${temp}°C). Akkus vor dem Start vorwärmen.`,
      `Low temperature (${temp}°C). Pre-warm the batteries before take-off.`,
    ]);
  } else {
    punkt('temp', 'pass', tempTitel, [`Optimaler Bereich (${temp}°C).`, `Optimal range (${temp}°C).`]);
  }

  // 4. Akku-Gesundheit (SOH)
  if (battery) {
    const soh = battery.health ?? 100;
    const akkuTitel: [string, string] = ['Akku-Zustand (SOH)', 'Battery health (SOH)'];
    if (soh < 60) {
      score -= 30;
      punkt('battery', 'fail', akkuTitel, [
        `Akku-Gesundheit kritisch niedrig (${soh}% SOH). Akku aussondern!`,
        `Battery health critically low (${soh}% SOH). Retire the battery!`,
      ]);
    } else if (soh < 80) {
      score -= 15;
      punkt('battery', 'warn', akkuTitel, [
        `Akku-Gesundheit bei ${soh}% SOH. Flugzeiten reduzieren.`,
        `Battery health at ${soh}% SOH. Reduce flight times.`,
      ]);
    } else {
      punkt('battery', 'pass', akkuTitel, [
        `Akku in hervorragendem Zustand (${soh}% SOH).`,
        `Battery in excellent condition (${soh}% SOH).`,
      ]);
    }
  }

  // 5. Pilotenlizenz
  if (profile) {
    const lizenzTitel: [string, string] = ['Fernpiloten-Nachweis', 'Remote pilot certificate'];
    if (profile.licenseType === 'None') {
      score -= 10;
      punkt('license', 'warn', lizenzTitel, [
        'Kein Kompetenznachweis angegeben (nur Open A1/A3 mit C0/Bestand <250 g erlaubt).',
        'No certificate of competency stored (only Open A1/A3 with C0/legacy <250 g allowed).',
      ]);
    } else {
      punkt('license', 'pass', lizenzTitel, [
        `Gültiger Nachweis (${profile.licenseType}) eingetragen.`,
        `Valid certificate (${profile.licenseType}) stored.`,
      ]);
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
