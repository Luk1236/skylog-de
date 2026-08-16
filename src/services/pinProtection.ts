const PIN_STORAGE_KEY = 'skylog_pin_hash_v1';
const PIN_ENABLED_KEY = 'skylog_pin_enabled_v1';

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

/**
 * Simple hashing for PIN storage in local storage
 */
export function hashPin(pin: string): string {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN muss exakt 4 Ziffern enthalten.');
  }
  let hash = 0;
  const salted = `skylog_salt_${pin}_2026`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

export function setPin(pin: string): void {
  const hashed = hashPin(pin);
  const storage = getStorage();
  if (storage) {
    storage.setItem(PIN_STORAGE_KEY, hashed);
    storage.setItem(PIN_ENABLED_KEY, 'true');
  }
}

export function removePin(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(PIN_STORAGE_KEY);
    storage.removeItem(PIN_ENABLED_KEY);
  }
}

export function isPinEnabled(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  return storage.getItem(PIN_ENABLED_KEY) === 'true' && !!storage.getItem(PIN_STORAGE_KEY);
}

export function verifyPin(pin: string): boolean {
  if (!isPinEnabled()) return true;
  const storage = getStorage();
  if (!storage) return false;
  const storedHash = storage.getItem(PIN_STORAGE_KEY);
  try {
    const hashedInput = hashPin(pin);
    return storedHash === hashedInput;
  } catch {
    return false;
  }
}
