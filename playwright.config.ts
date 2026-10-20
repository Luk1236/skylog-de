import { defineConfig, devices } from '@playwright/test';

// Oberflächentests der gebauten App (dist/) in einem echten Chromium.
// Vorher bauen: `npm run build:app` - `npm run e2e` erledigt beides.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    // Kein echter Standort: die App zeigt dann ihren GPS-Hinweis, wie bei einem
    // Nutzer, der die Freigabe ablehnt.
    permissions: [],
    locale: 'de-DE',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
