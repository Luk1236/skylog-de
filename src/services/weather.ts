export interface WeatherData {
  temp: number;
  /** Wind in 10 m Höhe (Startplatz-Niveau). */
  windSpeed: number;
  /** Wind in 120 m Höhe — der gesetzlichen Obergrenze für Drohnen. */
  windSpeed120: number;
  /** Böen in 10 m Höhe. Für Drohnen kritischer als der Mittelwind. */
  windGusts: number;
  condition: string;
  visibility: string;
  /** ISO-Zeitstempel, oder null wenn die API sie nicht geliefert hat. */
  sunrise: string | null;
  sunset: string | null;
}

export interface ForecastHour {
  time: string;
  temp: number;
  windSpeed: number;
  windSpeed120: number;
  windGusts: number;
  condition: string;
}

function codeToCondition(code: number): string {
  if (code > 0 && code < 4) return "Leicht bewölkt";
  if (code >= 45 && code <= 48) return "Neblig";
  if (code >= 51 && code <= 67) return "Regen";
  if (code >= 71 && code <= 77) return "Schnee";
  if (code >= 80) return "Gewitter";
  return "Klar";
}

function metersToVisibility(visMeters: number): string {
  if (visMeters < 1000) return "Schlecht";
  if (visMeters < 3000) return "Mäßig";
  if (visMeters < 8000) return "Gut";
  return "Sehr gut";
}

// Die API liefert einzelne Werte gelegentlich als null (Lücke im Modell).
// Ohne diesen Fallback landet null in der Anzeige und rechnet sich zu NaN weiter.
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export async function fetchForecast(lat: number, lon: number): Promise<ForecastHour[]> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m,wind_speed_120m,wind_gusts_10m,weather_code&forecast_days=1&timezone=auto`
    );
    const data = await response.json();
    const times: string[] = data.hourly.time;
    const temps: number[] = data.hourly.temperature_2m;
    const winds: number[] = data.hourly.wind_speed_10m;
    const winds120: number[] = data.hourly.wind_speed_120m ?? [];
    const gusts: number[] = data.hourly.wind_gusts_10m ?? [];
    const codes: number[] = data.hourly.weather_code;

    const nowHour = new Date().getHours();
    const startIdx = times.findIndex(t => new Date(t).getHours() >= nowHour);
    const from = startIdx === -1 ? 0 : startIdx;

    return times.slice(from, from + 6).map((t, i) => ({
      time: new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      temp: Math.round(num(temps[from + i])),
      windSpeed: Math.round(num(winds[from + i])),
      windSpeed120: Math.round(num(winds120[from + i])),
      windGusts: Math.round(num(gusts[from + i])),
      condition: codeToCondition(codes[from + i]),
    }));
  } catch {
    return [];
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m,wind_speed_120m,wind_gusts_10m,weather_code,visibility` +
      `&daily=sunrise,sunset&forecast_days=1&timezone=auto`
    );
    const data = await response.json();

    return {
      temp: num(data.current.temperature_2m),
      windSpeed: num(data.current.wind_speed_10m),
      windSpeed120: num(data.current.wind_speed_120m),
      windGusts: num(data.current.wind_gusts_10m),
      condition: codeToCondition(data.current.weather_code),
      visibility: metersToVisibility(data.current.visibility ?? 10000),
      sunrise: data.daily?.sunrise?.[0] ?? null,
      sunset: data.daily?.sunset?.[0] ?? null,
    };
  } catch (error) {
    console.error("Weather fetch failed", error);
    return {
      temp: 0,
      windSpeed: 0,
      windSpeed120: 0,
      windGusts: 0,
      condition: "Unbekannt",
      visibility: "Unbekannt",
      sunrise: null,
      sunset: null,
    };
  }
}

/** Minuten bis Sonnenuntergang, oder null wenn unbekannt / schon vorbei. */
export function minutesUntilSunset(sunset: string | null, now: Date = new Date()): number | null {
  if (!sunset) return null;
  const diffMs = new Date(sunset).getTime() - now.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  return Math.round(diffMs / 60000);
}
