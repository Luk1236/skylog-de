import type { CapacitorConfig } from '@capacitor/cli';

// appId und appName absichtlich identisch zur bisherigen Handy-App
// (com.skylog.app). Nur so erkennt Android die neue APK als dieselbe
// Anwendung und behaelt bei passender Signatur die gespeicherten Daten.
const config: CapacitorConfig = {
  appId: 'com.skylog.app',
  appName: 'SkyLog DE',
  webDir: 'dist',
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
