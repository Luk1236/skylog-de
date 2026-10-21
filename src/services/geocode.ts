// Standort ohne GPS bestimmen: Ortssuche (OpenStreetMap/Nominatim) und ein
// toleranter Parser für von Hand eingegebene Koordinaten.
//
// Hintergrund: Am Desktop oder bei verweigerter Standortfreigabe gibt es kein
// GPS. Dann soll der Pilot den Kartenmittelpunkt trotzdem setzen können — per
// Ortsname oder per Koordinatenpaar aus einer anderen Quelle.

import { appKennungKopf } from '../lib/appInfo';

export interface OrtsTreffer {
  name: string;
  lat: number;
  lon: number;
}

/** Liegt das Paar in gültigen geografischen Grenzen? */
export function sindGueltigeKoordinaten(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

/** Von Hand eingegebene Koordinaten lesen. Verträgt:
 *   "52.52, 13.40"   (Punkt-Dezimal, Komma-getrennt)
 *   "52.52 13.40"    (Leerzeichen-getrennt)
 *   "48,3705, 10,8978" (deutsches Dezimalkomma — vier Zahlteile)
 *   "N 48.37 E 10.89"  (Himmelsrichtungen werden ignoriert)
 *  Gibt null zurück, wenn nichts Sinnvolles herauskommt. */
export function parseKoordinaten(eingabe: string): [number, number] | null {
  if (!eingabe?.trim()) return null;

  // Himmelsrichtungen und Gradzeichen entfernen — die Vorzeichen stecken
  // ohnehin in den Zahlen, und N/E sind der Normalfall.
  const sauber = eingabe.replace(/[NEOWneow°]/g, ' ').trim();
  const teile = sauber.split(/[\s,;]+/).filter(Boolean);

  let lat: number;
  let lon: number;

  // Vier reine Ganzzahl-Teile: deutsches Dezimalkomma, z. B. "48,3705, 10,8978".
  if (teile.length === 4 && teile.every(t => /^-?\d+$/.test(t))) {
    lat = Number(`${teile[0]}.${teile[1]}`);
    lon = Number(`${teile[2]}.${teile[3]}`);
  } else if (teile.length >= 2) {
    lat = Number(teile[0]);
    lon = Number(teile[1]);
  } else {
    return null;
  }

  return sindGueltigeKoordinaten(lat, lon) ? [lat, lon] : null;
}

/** Orte über die OpenStreetMap-Nominatim-Suche finden.
 *  Bewusst begrenzt (limit=5) und fehlertolerant: kein Netz → leere Liste,
 *  nie eine Ausnahme, die die UI umwirft. */
export async function sucheOrte(
  anfrage: string,
  signal?: AbortSignal,
): Promise<OrtsTreffer[]> {
  const q = anfrage.trim();
  if (q.length < 2) return [];

  const url =
    'https://nominatim.openstreetmap.org/search' +
    `?format=jsonv2&limit=5&accept-language=de&q=${encodeURIComponent(q)}`;

  try {
    const antwort = await fetch(url, { signal, headers: { Accept: 'application/json', ...appKennungKopf() } });
    if (!antwort.ok) return [];
    const daten = (await antwort.json()) as Array<{
      display_name?: string; lat?: string; lon?: string;
    }>;
    return daten
      .map(d => ({
        name: d.display_name ?? '',
        lat: Number(d.lat),
        lon: Number(d.lon),
      }))
      .filter(t => t.name && sindGueltigeKoordinaten(t.lat, t.lon));
  } catch {
    return [];
  }
}

/** Kurzer Ortsname für Koordinaten (umgekehrte Nominatim-Suche), z. B.
 *  „Griesheim, Darmstadt-Dieburg". Kein Netz oder kein Treffer → null; dann
 *  zeigt die App weiter die Koordinaten. */
export async function ortsnameFuer(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  if (!sindGueltigeKoordinaten(lat, lon)) return null;
  const url =
    'https://nominatim.openstreetmap.org/reverse' +
    `?format=jsonv2&zoom=14&accept-language=de&lat=${lat}&lon=${lon}`;
  try {
    const antwort = await fetch(url, { signal, headers: { Accept: 'application/json', ...appKennungKopf() } });
    if (!antwort.ok) return null;
    return kurzerOrtsname(await antwort.json());
  } catch {
    return null;
  }
}

/** Aus einer Nominatim-Antwort einen kurzen Namen bauen: Ort und Kreis statt
 *  der kompletten Adresse mit Postleitzahl. */
export function kurzerOrtsname(daten: { address?: Record<string, string>; display_name?: string } | null): string | null {
  const a = daten?.address;
  if (a) {
    const ort = a.village || a.town || a.city || a.suburb || a.hamlet || a.municipality;
    const gebiet = a.county || a.state_district || a.state;
    const teile = [ort, gebiet].filter((x, i, alle): x is string => !!x && alle.indexOf(x) === i);
    if (teile.length) return teile.join(', ');
  }
  const roh = daten?.display_name?.split(',').slice(0, 2).map(s => s.trim()).filter(Boolean);
  return roh && roh.length ? roh.join(', ') : null;
}
