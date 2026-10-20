/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Version für die Anzeige in der App: im Release-Workflow aus dem Tag
 *  (SKYLOG_VERSION_NAME), sonst letzter Versions-Tag plus Commit-Zahl
 *  (= versionCode der APK), notfalls die Version aus package.json. */
function appVersion(): string {
  if (process.env.SKYLOG_VERSION_NAME) return process.env.SKYLOG_VERSION_NAME;
  const paket = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string;
  try {
    const tag = execSync("git describe --tags --match 'v*.*.*' --abbrev=0", { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().replace(/^v/, '');
    const build = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return `${tag} (Build ${build})`;
  } catch {
    return paket;
  }
}

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
    define: {
      __APP_VERSION__: JSON.stringify(appVersion()),
    },
    // Vitest: die Playwright-Tests (e2e/) laufen separat mit `npm run e2e`.
    test: {
      exclude: ['**/node_modules/**', 'dist/**', 'android/**', 'e2e/**'],
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Registrierung nicht render-blockierend einbinden (Lighthouse:
        // registerSW.js hielt den ersten Bildaufbau auf).
        injectRegister: 'script-defer',
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'datenschutz.html'],
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
              // Muss BEIDE Hosts und alle Leaflet-Subdomains treffen: Die Karte
              // laedt von openstreetmap.fr (HOT-Stil), der Flugplaner von
              // openstreetmap.org, und Leaflet verteilt auf a/b/c. Die fruehere
              // Regel ([ab]...org) passte auf keinen der beiden Faelle
              // vollstaendig — der Kachel-Cache griff dadurch nie.
              urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.(org|fr)\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'map-tiles', expiration: { maxEntries: 3000, maxAgeSeconds: 2592000 } },
            },
          ],
        },
      }),
    ],
    // Kein `define` für GEMINI_API_KEY: das würde den Schlüssel in den
    // Browser-Bundle einbacken. Er wird ausschließlich serverseitig benutzt
    // (server.ts bzw. api/safety-check.ts) und darf den Server nie verlassen.
    build: {
      // Schwere Fremdbibliotheken in eigene Vendor-Chunks trennen: kleinerer
      // Haupt-Chunk (unter der Warnschwelle) und besseres Caching, weil sich
      // diese Pakete selten ändern. jspdf/html2canvas liegen bereits durch
      // dynamische Importe (Lazy-Dialoge) getrennt vor.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('protomaps') || id.includes('pmtiles')) return 'vendor-maps';
            if (id.includes('react-leaflet') || id.includes('/leaflet/')) return 'vendor-leaflet';
            // recharts bewusst OHNE festen Chunk: sonst zieht der Bundler gemeinsam genutzte
            // Kleinbibliotheken (clsx …) mit hinein und der Erststart laedt ~375 kB Diagramme.
            // Ohne Regel landet recharts nur in den lazy geladenen Ansichten/Dialogen.
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
