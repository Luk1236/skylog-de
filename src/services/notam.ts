export interface Notam {
  id: string;
  location: string;
  startDate: string;
  endDate: string;
  text: string;
  type: string;
}

// Ordnet einen Ort einer der drei deutschen FIRs zu.
//
// ACHTUNG: bewusst eine Näherung. Die echten FIR-Grenzen sind Polygone und
// folgen keiner Breiten-/Längengrad-Linie. Für eine verbindliche Auskunft
// braucht es die amtlichen Grenzverläufe (DFS/AIP) statt dieser Heuristik.
//
// Gegenüber der reinen Breitengrad-Prüfung wird hier zusätzlich der
// Längengrad ausgewertet: im mittleren Streifen liegt der Osten (Sachsen,
// Ost-Thüringen) in München, nicht in Langen — Dresden etwa wurde vorher
// fälschlich Langen zugeordnet.
export function getGermanFir(lat: number, lon: number): 'EDWW' | 'EDGG' | 'EDMM' {
  if (lat >= 52.0) return 'EDWW';  // Bremen FIR – Norddeutschland
  if (lat <= 49.5) return 'EDMM';  // München FIR – Süddeutschland

  // Mittlerer Streifen: Ost/West am Längengrad trennen.
  return lon >= 11.5 ? 'EDMM' : 'EDGG';
}

export async function fetchNotams(
  lat: number,
  lon: number,
  clientId: string,
  clientSecret: string
): Promise<Notam[]> {
  const fir = getGermanFir(lat, lon);
  try {
    const res = await fetch(
      `https://api.faa.gov/notamapi/v1/notams?icaoLocation=${fir}&pageSize=10&sortBy=effectiveStartDate&sortOrder=Desc`,
      { headers: { client_id: clientId, client_secret: clientSecret } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? [])
      .map((item: any) => {
        const n = item.properties?.coreNOTAMData?.notam;
        if (!n?.id) return null;
        return {
          id: n.id,
          location: n.location ?? fir,
          startDate: n.effectiveStart ?? '',
          endDate: n.effectiveEnd ?? '',
          text: n.text ?? '',
          type: item.properties?.coreNOTAMData?.notamType?.code ?? 'N',
        } as Notam;
      })
      .filter(Boolean) as Notam[];
  } catch {
    return [];
  }
}

export function formatNotamDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Returns a short human-readable summary of the NOTAM text
export function summariseNotam(text: string): string {
  if (!text) return '';
  // Take first 120 chars; trim at last space
  const trimmed = text.length > 120 ? text.slice(0, 120).replace(/\s\S*$/, '') + '…' : text;
  return trimmed;
}
