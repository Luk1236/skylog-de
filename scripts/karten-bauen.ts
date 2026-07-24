// Baut die Regions-Karten aus dem App-Katalog.
//
// Liest REGIONEN direkt aus src/services/mapRegions.ts — die Bounding-Boxen
// stehen damit an genau EINER Stelle. Käme hier eine zweite Tabelle hin,
// würden App und Bauskript irgendwann auseinanderlaufen und die App böte
// Regionen an, die es als Datei gar nicht gibt.
//
// Aufruf (vite-node kann TypeScript direkt):
//   npx vite-node scripts/karten-bauen.ts              -> alle Regionen
//   npx vite-node scripts/karten-bauen.ts de-suedost   -> nur eine
//
// Ergebnis liegt in dist-karten/ und wird von dort als GitHub-Release-Asset
// hochgeladen (Tag: karten-v1, siehe RELEASE_BASIS in mapRegions.ts).

import { join } from 'node:path';
import { REGIONEN } from '../src/services/mapRegions';
import { extrahiere } from './karte-extrahieren.mjs';

const AUSGABE = 'dist-karten';

async function main() {
  const gewaehlt = process.argv[2];
  const regionen = gewaehlt
    ? REGIONEN.filter((r) => r.code === gewaehlt)
    : REGIONEN;

  if (regionen.length === 0) {
    console.error(`Unbekannte Region "${gewaehlt}". Verfügbar:`);
    for (const r of REGIONEN) console.error(`  ${r.code}  (${r.name})`);
    process.exit(1);
  }

  for (const r of regionen) {
    const { minLon, minLat, maxLon, maxLat } = r.bbox;
    console.log(`\n=== ${r.name} (${r.code}) ===`);
    await extrahiere({
      bbox: `${minLon},${minLat},${maxLon},${maxLat}`,
      maxzoom: String(r.maxZoom),
      ziel: join(AUSGABE, r.datei),
    });
  }

  console.log(`\nAlle Dateien liegen in ${AUSGABE}/.`);
  console.log('Nächster Schritt: als Assets an ein GitHub-Release mit dem Tag "karten-v1" hängen.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
