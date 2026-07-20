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
};

export default config;
