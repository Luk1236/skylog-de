// Wo liegen die /api-Endpunkte (KI-Sicherheitscheck)?
//
// Im Browser liefert derselbe Server Seite und API aus - relative Pfade reichen.
// In der Android-App gibt es keinen Server: '/api/...' liefe dort ins Leere
// (https://localhost/api/...). Fuer die APK wird deshalb beim Bauen
// VITE_API_BASE auf die Vercel-Adresse gesetzt (GitHub-Variable SKYLOG_API_URL).
// CapacitorHttp leitet fetch nativ um, CORS spielt dort keine Rolle.

/** Baut die URL fuer einen /api-Pfad. Gibt null zurueck, wenn die App nativ
 *  laeuft und kein Server hinterlegt ist - dann gar nicht erst anfragen. */
export function apiUrl(pfad: string, basis: string | undefined, nativ: boolean): string | null {
  const b = (basis ?? '').trim().replace(/\/+$/, '');
  if (b) return `${b}${pfad}`;
  return nativ ? null : pfad;
}
