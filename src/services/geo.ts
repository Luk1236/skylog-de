// Kleine Geo-Helfer ohne weitere Abhängigkeiten - damit sie auch im Erststart
// (App.tsx) genutzt werden können, ohne den Track-/Import-Code mitzuladen.

/** Meter zwischen zwei Koordinaten (Haversine). */
export function distanzMeter(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
