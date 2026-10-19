// PIN-Bildschirmsperre.
//
// Ehrlich eingeordnet: Das ist eine BILDSCHIRMSPERRE gegen neugierige Blicke,
// keine Verschlüsselung. Die Flugdaten liegen unverschlüsselt in IndexedDB.
// Wer Zugriff auf den Browser-Speicher hat, kommt an die Daten auch ohne PIN.
//
// Gespeichert wird nur ein PBKDF2-SHA256-Hash mit zufälligem Salz (v2). Das
// frühere Verfahren (v1, 32-Bit-Hash mit festem Salz) wird beim nächsten
// erfolgreichen Entsperren automatisch auf v2 umgestellt.
// Gegen Durchprobieren in der App: nach mehreren Fehlversuchen wächst die
// Wartezeit (10.000 mögliche PINs sind sonst schnell durch).

const PIN_V1_KEY = 'skylog_pin_hash_v1';
const PIN_V2_KEY = 'skylog_pin_hash_v2';
const PIN_ENABLED_KEY = 'skylog_pin_enabled_v1';
const FAILS_KEY = 'skylog_pin_fails_v1';

const ITERATIONEN = 310_000;
const FREIE_VERSUCHE = 5;

interface PinHashV2 { v: 2; salt: string; iter: number; hash: string }
interface Fehlversuche { anzahl: number; gesperrtBis: number }

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

function pruefeFormat(pin: string): void {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN muss exakt 4 Ziffern enthalten.');
}

const zuBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const ausBase64 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function pbkdf2(pin: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter },
    key,
    256,
  );
  return zuBase64(new Uint8Array(bits));
}

/** Altes v1-Verfahren - nur noch zum Prüfen und Umstellen bestehender PINs. */
export function hashPinV1(pin: string): string {
  pruefeFormat(pin);
  let hash = 0;
  const salted = `skylog_salt_${pin}_2026`;
  for (let i = 0; i < salted.length; i++) {
    hash = (hash << 5) - hash + salted.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

/** Vergleich ohne frühen Abbruch (kein Zeit-Seitenkanal beim Vergleichen). */
function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function setPin(pin: string): Promise<void> {
  pruefeFormat(pin);
  const storage = getStorage();
  if (!storage) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const eintrag: PinHashV2 = { v: 2, salt: zuBase64(salt), iter: ITERATIONEN, hash: await pbkdf2(pin, salt, ITERATIONEN) };
  storage.setItem(PIN_V2_KEY, JSON.stringify(eintrag));
  storage.removeItem(PIN_V1_KEY);
  storage.setItem(PIN_ENABLED_KEY, 'true');
  storage.removeItem(FAILS_KEY);
}

export function removePin(): void {
  const storage = getStorage();
  if (!storage) return;
  for (const k of [PIN_V1_KEY, PIN_V2_KEY, PIN_ENABLED_KEY, FAILS_KEY]) storage.removeItem(k);
}

export function isPinEnabled(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  return storage.getItem(PIN_ENABLED_KEY) === 'true'
    && !!(storage.getItem(PIN_V2_KEY) || storage.getItem(PIN_V1_KEY));
}

function leseFehlversuche(storage: Storage): Fehlversuche {
  try {
    const roh = JSON.parse(storage.getItem(FAILS_KEY) || 'null') as Fehlversuche | null;
    if (roh && typeof roh.anzahl === 'number' && typeof roh.gesperrtBis === 'number') return roh;
  } catch { /* defekter Eintrag zählt als keiner */ }
  return { anzahl: 0, gesperrtBis: 0 };
}

/** Wartezeit nach n Fehlversuchen: die ersten frei, dann 30 s, 60 s, 120 s … max. 15 min. */
export function wartezeitMs(anzahl: number): number {
  if (anzahl < FREIE_VERSUCHE) return 0;
  return Math.min(30_000 * 2 ** (anzahl - FREIE_VERSUCHE), 15 * 60_000);
}

/** Restliche Sperrzeit in Sekunden (0 = Eingabe erlaubt). */
export function sperreRestSekunden(now = Date.now()): number {
  const storage = getStorage();
  if (!storage) return 0;
  return Math.max(0, Math.ceil((leseFehlversuche(storage).gesperrtBis - now) / 1000));
}

export type PinErgebnis = { ok: true } | { ok: false; gesperrtSekunden: number };

export async function verifyPin(pin: string, now = Date.now()): Promise<PinErgebnis> {
  if (!isPinEnabled()) return { ok: true };
  const storage = getStorage();
  if (!storage) return { ok: false, gesperrtSekunden: 0 };

  const rest = sperreRestSekunden(now);
  if (rest > 0) return { ok: false, gesperrtSekunden: rest };

  let ok = false;
  try {
    pruefeFormat(pin);
    const v2 = storage.getItem(PIN_V2_KEY);
    if (v2) {
      const e = JSON.parse(v2) as PinHashV2;
      ok = gleich(await pbkdf2(pin, ausBase64(e.salt), e.iter), e.hash);
    } else {
      const v1 = storage.getItem(PIN_V1_KEY);
      ok = !!v1 && gleich(hashPinV1(pin), v1);
      if (ok) await setPin(pin); // stillschweigend auf v2 umstellen
    }
  } catch {
    /* defekter Eintrag oder ungültiges Format: ok bleibt false */
  }

  if (ok) {
    storage.removeItem(FAILS_KEY);
    return { ok: true };
  }
  const f = leseFehlversuche(storage);
  const anzahl = f.anzahl + 1;
  const warten = wartezeitMs(anzahl);
  storage.setItem(FAILS_KEY, JSON.stringify({ anzahl, gesperrtBis: now + warten }));
  return { ok: false, gesperrtSekunden: Math.ceil(warten / 1000) };
}
