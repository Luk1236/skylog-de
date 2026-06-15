export interface Notam {
  id: string;
  location: string;
  startDate: string;
  endDate: string;
  text: string;
  type: string;
}

// Determine which German FIR covers the given lat/lon
export function getGermanFir(lat: number): 'EDWW' | 'EDGG' | 'EDMM' {
  if (lat >= 52.0) return 'EDWW';  // Bremen FIR – northern Germany
  if (lat <= 49.5) return 'EDMM';  // Munich FIR – southern Germany
  return 'EDGG';                    // Langen FIR – central/western Germany
}

export async function fetchNotams(
  lat: number,
  _lon: number,
  clientId: string,
  clientSecret: string
): Promise<Notam[]> {
  const fir = getGermanFir(lat);
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
