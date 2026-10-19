// Verschlüsselte Sicherungsdateien.
//
// Wer seine Sicherung in eine Cloud legt (Google Drive, Nextcloud …), gibt sie
// aus der Hand. Mit Passwort wird der Inhalt mit AES-256-GCM verschlüsselt; der
// Schlüssel kommt per PBKDF2-SHA256 (310.000 Runden, Zufallssalz) aus dem
// Passwort. GCM erkennt zugleich jede Veränderung der Datei.
//
// Das Passwort wird nirgends gespeichert. Ist es weg, ist die Sicherung weg.

export const ITERATIONEN = 310_000;

export interface VerschluesselteSicherung {
  app: 'SkyLog DE';
  verschluesselt: true;
  format: 1;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string;
  iv: string;
  daten: string;
}

export class FalschesPasswortFehler extends Error {
  constructor() {
    super('Falsches Passwort – oder die Datei wurde verändert.');
    this.name = 'FalschesPasswortFehler';
  }
}

function zuBase64(bytes: Uint8Array): string {
  // In Stücken, damit große Sicherungen den Aufruf-Stack nicht sprengen.
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function ausBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function schluessel(passwort: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const basis = await crypto.subtle.importKey('raw', new TextEncoder().encode(passwort), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter },
    basis,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function istVerschluesselt(x: unknown): x is VerschluesselteSicherung {
  return !!x && typeof x === 'object'
    && (x as { verschluesselt?: unknown }).verschluesselt === true
    && (x as { app?: unknown }).app === 'SkyLog DE';
}

export async function verschluessele(klartext: string, passwort: string, iter = ITERATIONEN): Promise<VerschluesselteSicherung> {
  if (passwort.length < 8) throw new Error('Das Passwort muss mindestens 8 Zeichen haben.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await schluessel(passwort, salt, iter);
  const chiffrat = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(klartext));
  return {
    app: 'SkyLog DE', verschluesselt: true, format: 1, kdf: 'PBKDF2-SHA256',
    iter, salt: zuBase64(salt), iv: zuBase64(iv), daten: zuBase64(new Uint8Array(chiffrat)),
  };
}

export async function entschluessele(datei: VerschluesselteSicherung, passwort: string): Promise<string> {
  if (datei.format !== 1 || datei.kdf !== 'PBKDF2-SHA256') {
    throw new Error('Unbekanntes Verschlüsselungsformat – bitte die App aktualisieren.');
  }
  const key = await schluessel(passwort, ausBase64(datei.salt), datei.iter);
  try {
    const klar = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ausBase64(datei.iv) as BufferSource },
      key,
      ausBase64(datei.daten) as BufferSource,
    );
    return new TextDecoder().decode(klar);
  } catch {
    throw new FalschesPasswortFehler();
  }
}
