import type { CapacitorConfig } from '@capacitor/cli';

// appId und appName absichtlich identisch zur bisherigen Handy-App
// (com.skylog.app). Nur so erkennt Android die neue APK als dieselbe
// Anwendung und behaelt bei passender Signatur die gespeicherten Daten.
const config: CapacitorConfig = {
  appId: 'com.skylog.app',
  appName: 'SkyLog DE',
  webDir: 'dist',
  // Eigene, feste Kennung für Kartenkacheln und Ortssuche: Die Regeln der
  // OpenStreetMap Foundation verlangen sie von Apps. Gleicher Text wie
  // APP_KENNUNG in src/lib/appInfo.ts (dort für die nativen Abrufe).
  appendUserAgent: 'SkyLogDE (+https://github.com/Luk1236/skylog-de)',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Leitet fetch/XHR auf nativ um. Dadurch greift in der App die
    // CORS-Prüfung des WebViews nicht — nötig für aviationweather.gov,
    // das keine CORS-Header sendet. Im Web-Browser bleibt alles wie
    // gehabt (dort läuft der Aufruf über den /api/aviation-Proxy).
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
