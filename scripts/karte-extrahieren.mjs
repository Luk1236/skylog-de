#!/usr/bin/env node
// Erzeugt die Offline-Karte (PMTiles) für eine feste Region.
//
// Warum als Bau-Schritt statt eingecheckt: Die Datei ist je nach Region und
// Zoomstufe 50 MB bis über 1 GB groß. Im Git-Repo würde sie jeden Klon und
// jeden CI-Lauf ausbremsen. Also wird sie beim APK-Bau erzeugt und landet nur
// in der fertigen App.
//
// Warum Protomaps: OSM verbietet das Vorab-Herunterladen von Kacheln
// ausdrücklich. PMTiles ist das offene, schlüsselfreie Format; `pmtiles extract`
// holt per HTTP-Range nur den gewünschten Ausschnitt aus dem Welt-Build,
// lädt also nicht den ganzen Planeten herunter.
//
// Aufruf:  node scripts/karte-extrahieren.mjs
// Region ändern: die Umgebungsvariablen unten setzen (oder KARTE_BBOX anpassen).

import { existsSync, mkdirSync, statSync, chmodSync, createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- Konfiguration -------------------------------------------------------
// Standard: ganz Deutschland, aber zoombegrenzt, damit die Datei handhabbar
// bleibt. Jede weitere Zoomstufe verdoppelt die Größe ungefähr.
// Für „mein Flugumkreis, dafür scharf" hier eine kleinere BBox eintragen und
// KARTE_MAXZOOM auf 15 setzen.
const BBOX = process.env.KARTE_BBOX ?? '5.87,47.27,15.04,55.06'; // west,süd,ost,nord
const MAXZOOM = process.env.KARTE_MAXZOOM ?? '12';
const ZIEL = join(wurzel, 'public', 'karten', 'region.pmtiles');
const CLI_VERSION = process.env.PMTILES_CLI_VERSION ?? '1.22.1';

// --- pmtiles-CLI besorgen ------------------------------------------------
function cliDateiname() {
  const p = process.platform;
  const a = process.arch === 'arm64' ? 'arm64' : 'x86_64';
  if (p === 'win32') return { datei: 'pmtiles.exe', archiv: `go-pmtiles_${CLI_VERSION}_Windows_${a}.zip` };
  if (p === 'darwin') return { datei: 'pmtiles', archiv: `go-pmtiles_${CLI_VERSION}_Darwin_${a}.zip` };
  return { datei: 'pmtiles', archiv: `go-pmtiles_${CLI_VERSION}_Linux_${a}.tar.gz` };
}

async function ladeDatei(url, ziel) {
  const antwort = await fetch(url, { redirect: 'follow' });
  if (!antwort.ok) throw new Error(`Download fehlgeschlagen (${antwort.status}): ${url}`);
  await pipeline(Readable.fromWeb(antwort.body), createWriteStream(ziel));
}

async function holeCli() {
  const vorhanden = spawnSync('pmtiles', ['version'], { encoding: 'utf8' });
  if (vorhanden.status === 0) return 'pmtiles'; // schon im PATH

  const cache = join(wurzel, '.cache');
  mkdirSync(cache, { recursive: true });
  const { datei, archiv } = cliDateiname();
  const binaer = join(cache, datei);
  if (existsSync(binaer)) return binaer;

  const url = `https://github.com/protomaps/go-pmtiles/releases/download/v${CLI_VERSION}/${archiv}`;
  const archivPfad = join(cache, archiv);
  console.log(`Lade pmtiles-CLI: ${url}`);
  await ladeDatei(url, archivPfad);

  // Entpacken mit Bordmitteln.
  const entpackt = archiv.endsWith('.zip')
    ? spawnSync('tar', ['-xf', archivPfad, '-C', cache], { stdio: 'inherit' })
    : spawnSync('tar', ['-xzf', archivPfad, '-C', cache], { stdio: 'inherit' });
  if (entpackt.status !== 0) throw new Error('Entpacken der pmtiles-CLI fehlgeschlagen.');
  if (process.platform !== 'win32') chmodSync(binaer, 0o755);
  return binaer;
}

// --- Neuesten Welt-Build finden -----------------------------------------
// Die Übersichtsseite maps.protomaps.com/builds ist eine JavaScript-App und
// enthält im HTML keine Dateinamen — dort zu suchen schlägt fehl. Die Liste
// steht maschinenlesbar unter build-metadata.protomaps.dev/builds.json, die
// Dateien liegen unter build.protomaps.com/<key>.
// Am 2026-07-24 gegen den Live-Dienst geprüft (Range-Abruf liefert 206).
const BUILD_LISTE = 'https://build-metadata.protomaps.dev/builds.json';
const BUILD_BASIS = 'https://build.protomaps.com';

async function ermittleQuelle() {
  if (process.env.PMTILES_QUELLE) return process.env.PMTILES_QUELLE;

  const antwort = await fetch(BUILD_LISTE);
  if (!antwort.ok) {
    throw new Error(
      `Build-Liste nicht erreichbar (HTTP ${antwort.status}). Quelle direkt setzen, z.B.\n` +
      `  PMTILES_QUELLE=${BUILD_BASIS}/20260724.pmtiles npx vite-node scripts/karten-bauen.ts`
    );
  }
  const liste = await antwort.json();
  if (!Array.isArray(liste) || liste.length === 0) {
    throw new Error('Build-Liste war leer oder hatte ein unerwartetes Format.');
  }
  // Nach Upload-Zeitpunkt sortieren statt auf die Reihenfolge zu vertrauen.
  const neueste = [...liste]
    .filter((e) => typeof e?.key === 'string' && e.key.endsWith('.pmtiles'))
    .sort((a, b) => String(a.uploaded ?? a.key).localeCompare(String(b.uploaded ?? b.key)))
    .pop();
  if (!neueste) throw new Error('Kein .pmtiles-Eintrag in der Build-Liste gefunden.');

  const gb = neueste.size ? ` (Welt-Build ${(neueste.size / 1e9).toFixed(0)} GB)` : '';
  console.log(`Neuester Build: ${neueste.key}${gb}`);
  return `${BUILD_BASIS}/${neueste.key}`;
}

// --- Wiederverwendbar ----------------------------------------------------
/** Einen Ausschnitt herausziehen. Wird auch von scripts/karten-bauen.ts
 *  benutzt, das die Regionen aus dem App-Katalog liest — damit die
 *  Bounding-Boxen nur an EINER Stelle stehen. */
export async function extrahiere({ bbox, maxzoom, ziel }) {
  mkdirSync(dirname(ziel), { recursive: true });
  const cli = await holeCli();
  const quelle = await ermittleQuelle();

  console.log(`Quelle:  ${quelle}`);
  console.log(`Gebiet:  ${bbox}  (maxzoom ${maxzoom})`);
  console.log(`Ziel:    ${ziel}`);
  console.log('Das lädt nur den gewählten Ausschnitt, nicht den ganzen Planeten — dauert trotzdem.');

  const lauf = spawnSync(
    cli,
    ['extract', quelle, ziel, `--bbox=${bbox}`, `--maxzoom=${maxzoom}`],
    { stdio: 'inherit' }
  );
  if (lauf.status !== 0) {
    throw new Error(`pmtiles extract ist fehlgeschlagen (Code ${lauf.status}).`);
  }

  const mb = (statSync(ziel).size / (1024 * 1024)).toFixed(1);
  console.log(`\nFertig: ${ziel} (${mb} MB)`);
  return ziel;
}

// --- Hauptlauf (direkter Aufruf) ----------------------------------------
async function main() {
  await extrahiere({ bbox: BBOX, maxzoom: MAXZOOM, ziel: ZIEL });
}

// Nur ausführen, wenn direkt gestartet — nicht beim Import.
if (process.argv[1] && process.argv[1].endsWith('karte-extrahieren.mjs')) {
  main().catch(fehlerBehandlung);
}

export function fehlerBehandlung(err) {
  console.error(`\nOffline-Karte konnte nicht erzeugt werden:\n${err.message}`);
  // Kein harter Abbruch des Gesamtbaus: Die App fällt ohne die Datei auf die
  // Online-Karte zurück. Der Bau soll daran nicht scheitern.
  process.exit(process.env.KARTE_PFLICHT === '1' ? 1 : 0);
}
