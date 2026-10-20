// Erzeugt die PNG-Icons für Installation (Android/iOS/PWA) aus public/icon.svg.
// Aufruf: node scripts/icons-erzeugen.mjs  (nutzt das Chromium von Playwright)
import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const ziel = (name) => new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// maskable: Android schneidet Icons rund/eckig zu - der Inhalt muss in den
// inneren 80 % liegen, der Hintergrund bis an den Rand reichen.
const varianten = [
  { name: 'icon-192.png', groesse: 192, maskable: false },
  { name: 'icon-512.png', groesse: 512, maskable: false },
  { name: 'icon-maskable-512.png', groesse: 512, maskable: true },
  { name: 'apple-touch-icon.png', groesse: 180, maskable: true },
];

const browser = await chromium.launch();
const seite = await browser.newPage();
for (const v of varianten) {
  await seite.setViewportSize({ width: v.groesse, height: v.groesse });
  const innen = v.maskable ? Math.round(v.groesse * 0.8) : v.groesse;
  await seite.setContent(`<!doctype html><html><body style="margin:0;background:${v.maskable ? '#1e3a8a' : 'transparent'};display:flex;align-items:center;justify-content:center;width:${v.groesse}px;height:${v.groesse}px">
    <div style="width:${innen}px;height:${innen}px">${svg.replace('<svg ', `<svg width="${innen}" height="${innen}" `)}</div></body></html>`);
  await seite.screenshot({ path: ziel(v.name), omitBackground: !v.maskable });
  console.log('geschrieben:', v.name);
}
await browser.close();
