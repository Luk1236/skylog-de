export interface WeatherData {
  temp: number;
  windSpeed: number;
  condition: string;
  visibility: string;
}

export interface ForecastHour {
  time: string;
  temp: number;
  windSpeed: number;
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

export async function fetchForecast(lat: number, lon: number): Promise<ForecastHour[]> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m,weather_code&forecast_days=1&timezone=auto`
    );
    const data = await response.json();
    const times: string[] = data.hourly.time;
    const temps: number[] = data.hourly.temperature_2m;
    const winds: number[] = data.hourly.wind_speed_10m;
    const codes: number[] = data.hourly.weather_code;

    const nowHour = new Date().getHours();
    const startIdx = times.findIndex(t => new Date(t).getHours() >= nowHour);
    const from = startIdx === -1 ? 0 : startIdx;

    return times.slice(from, from + 6).map((t, i) => ({
      time: new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      temp: Math.round(temps[from + i]),
      windSpeed: Math.round(winds[from + i]),
      condition: codeToCondition(codes[from + i]),
    }));
  } catch {
    return [];
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code,visibility`
    );
    const data = await response.json();

    const code = data.current.weather_code;
    let condition = "Klar";
    if (code > 0 && code < 4) condition = "Leicht bewölkt";
    if (code >= 45 && code <= 48) condition = "Neblig";
    if (code >= 51 && code <= 67) condition = "Regen";
    if (code >= 71 && code <= 77) condition = "Schnee";
    if (code >= 80) condition = "Gewitter";

    const visMeters: number = data.current.visibility ?? 10000;
    let visibility = "Sehr gut";
    if (visMeters < 1000) visibility = "Schlecht";
    else if (visMeters < 3000) visibility = "Mäßig";
    else if (visMeters < 8000) visibility = "Gut";

    return {
      temp: data.current.temperature_2m,
      windSpeed: data.current.wind_speed_10m,
      condition,
      visibility,
    };
  } catch (error) {
    console.error("Weather fetch failed", error);
    return { temp: 0, windSpeed: 0, condition: "Unbekannt", visibility: "Unbekannt" };
  }
}
