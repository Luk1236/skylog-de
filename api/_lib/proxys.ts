// Proxys fuer den Browser - gemeinsam fuer server.ts (Express) und die
// Vercel-Funktionen unter api/. In der Android-App werden sie nicht gebraucht:
// dort laufen die Abrufe nativ ueber CapacitorHttp, ohne CORS-Pruefung.
//
// Jede Funktion liefert Status, Kopfzeilen und Inhalt; das Senden uebernimmt
// der jeweilige Server. Ziele sind fest vorgegeben - eine frei waehlbare
// Ziel-URL waere ein offener Weiterleitungsdienst.

import { ZONEN_QUELLEN } from '../../src/services/euZones';

export interface ProxyAntwort {
  status: number;
  headers?: Record<string, string>;
  /** JSON-Objekt, fertiger Text oder Binaerdaten. */
  body: unknown;
  art: 'json' | 'text' | 'binaer';
}

const fehler = (status: number, error: string): ProxyAntwort => ({ status, body: { error }, art: 'json' });

/** Luftfahrtwetter (aviationweather.gov / NOAA) - sendet keine CORS-Header
 *  und antwortet nur mit gesetztem User-Agent. */
export async function luftfahrtwetter(artRoh: string, ids?: string, bbox?: string): Promise<ProxyAntwort> {
  const art = artRoh === 'taf' ? 'taf' : 'metar';
  if (!ids && !bbox) return fehler(400, 'ids oder bbox erforderlich');
  const params = new URLSearchParams({ format: 'json' });
  if (ids) params.set('ids', ids);
  if (bbox) params.set('bbox', bbox);
  try {
    const antwort = await fetch(`https://aviationweather.gov/api/data/${art}?${params}`, {
      headers: { 'User-Agent': 'SkyLog-DE/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!antwort.ok) return fehler(antwort.status, `Wetterdienst antwortete mit ${antwort.status}`);
    return { status: 200, body: await antwort.json(), art: 'json' };
  } catch (error) {
    console.error('Aviation weather error:', error);
    return fehler(502, 'Luftfahrtwetter nicht erreichbar');
  }
}

/** Amtliche Zonendatei eines Landes (nur gepruefte Adressen aus ZONEN_QUELLEN).
 *  Liefert die Quelle kein JSON, gibt es einen ehrlichen Fehler - nie eine
 *  erfundene Ersatzzone. */
export async function zonen(landRoh: string): Promise<ProxyAntwort> {
  const code = String(landRoh).toUpperCase();
  const ziel = ZONEN_QUELLEN.find(q => q.code === code)?.direktUrl;
  if (!ziel) return fehler(404, 'Fuer dieses Land ist keine Direktquelle hinterlegt');
  try {
    const antwort = await fetch(ziel, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!antwort.ok) return fehler(502, `Quelle antwortete mit ${antwort.status}`);
    const text = await antwort.text();
    try {
      JSON.parse(text.replace(/^﻿/, ''));
    } catch {
      return fehler(502, 'Quelle lieferte keine JSON-Daten');
    }
    return { status: 200, headers: { 'content-type': 'application/json' }, body: text, art: 'text' };
  } catch (error) {
    console.warn(`Zonen-Proxy: Quelle fuer ${code} nicht erreichbar:`, error);
    return fehler(502, 'Quelle nicht erreichbar');
  }
}

/** Offline-Kartendateien (GitHub-Release-Assets, ohne CORS-Header). Der
 *  Range-Header wird durchgereicht und der 206-Status bleibt erhalten -
 *  sonst laedt PMTiles jedes Mal die ganze Datei. */
export async function karte(datei: string, range?: string): Promise<ProxyAntwort> {
  if (!/^[a-z0-9-]+\.pmtiles$/i.test(datei)) return fehler(400, 'Ungueltiger Dateiname');
  const ziel = `https://github.com/Luk1236/skylog-de/releases/download/karten-v1/${datei}`;
  try {
    const antwort = await fetch(ziel, { headers: range ? { Range: range } : {}, redirect: 'follow' });
    const headers: Record<string, string> = {};
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag']) {
      const wert = antwort.headers.get(name);
      if (wert) headers[name] = wert;
    }
    return { status: antwort.status, headers, body: Buffer.from(await antwort.arrayBuffer()), art: 'binaer' };
  } catch (error) {
    console.error('Karten-Proxy Fehler:', error);
    return fehler(502, 'Karte nicht erreichbar');
  }
}

/** Minimale Antwort-Schnittstelle, die Express und Vercel beide erfuellen. */
export interface Antwortobjekt {
  status(code: number): Antwortobjekt;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
  send(body: unknown): unknown;
}

export function sende(res: Antwortobjekt, a: ProxyAntwort): void {
  for (const [name, wert] of Object.entries(a.headers ?? {})) res.setHeader(name, wert);
  res.status(a.status);
  if (a.art === 'json') res.json(a.body);
  else res.send(a.body);
}
