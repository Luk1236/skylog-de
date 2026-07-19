import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  // Die Basis-URL haengt vom Ziel ab, NICHT davon ob wir in CI laufen:
  //   'pages'  -> GitHub Pages liegt unter /skylog-de/
  //   sonst    -> Wurzel. Das gilt fuer lokale Builds UND fuer die Android-App:
  //               in der APK werden die Dateien aus dem Wurzelverzeichnis des
  //               WebViews geladen. Mit '/skylog-de/' bliebe die App weiss.
  // Frueher stand hier GITHUB_ACTIONS === 'true' - das haette den APK-Bau in
  // GitHub Actions faelschlich als Pages-Build behandelt.
  const isGhPages = process.env.DEPLOY_TARGET === 'pages';
  return {
    base: isGhPages ? '/skylog-de/' : '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'datenschutz.html'],
        manifest: false, // we use our own public/manifest.json
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
              handler: 'NetworkFirst',
              options: { cacheName: 'weather-cache', expiration: { maxAgeSeconds: 3600 } },
            },
            {
              urlPattern: /^https:\/\/[ab]\.tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'map-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 604800 } },
            },
          ],
        },
      }),
    ],
    // Kein `define` für GEMINI_API_KEY: das würde den Schlüssel in den
    // Browser-Bundle einbacken. Er wird ausschließlich serverseitig benutzt
    // (server.ts bzw. api/safety-check.ts) und darf den Server nie verlassen.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
