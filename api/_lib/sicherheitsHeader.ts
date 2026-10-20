// Sicherheits- und Cache-Header der Web-Version. Vercel liest nur vercel.json -
// dort steht dieselbe Liste; src/konfiguration.test.ts prüft, dass beide
// übereinstimmen. server.ts setzt die Header im Produktionsbetrieb selbst.
//
// Content-Security-Policy: Skripte nur von der eigenen Seite. Abrufe (fetch,
// auch im Service Worker) nur zu den Diensten, die die App wirklich nutzt.
// Bilder von jedem HTTPS-Host (Kartenkacheln, WMS-Zonen) sowie data:/blob:
// für Fotos. 'unsafe-inline' nur bei Styles - Leaflet und React setzen
// Inline-Styles. Neue Dienste müssen hier UND in vercel.json ergänzt werden.

const ABRUFE = [
  "'self'",
  'https://api.open-meteo.com', // Wetter
  'https://services.swpc.noaa.gov', // Kp-Index
  'https://nominatim.openstreetmap.org', // Ortsnamen
  'https://api.faa.gov', // NOTAM
  'https://uas-betrieb.de', // DIPUL-Zonen (Abfrage am Punkt)
  'https://*.tile.openstreetmap.fr', // Kachel-Cache im Service Worker
  'https://*.tile.openstreetmap.org',
];

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${ABRUFE.join(' ')}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SICHERHEITS_HEADER: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  'X-Frame-Options': 'DENY',
};

/** Dateien unter /assets/ tragen einen Hash im Namen und ändern sich nie. */
export const ASSET_CACHE = 'public, max-age=31536000, immutable';
