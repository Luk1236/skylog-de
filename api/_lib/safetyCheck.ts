// Gemeinsame Logik des KI-Sicherheitschecks fuer server.ts (Express) und
// api/safety-check.ts (Vercel). Der Unterstrich im Ordnernamen sorgt dafuer,
// dass Vercel diese Datei NICHT als eigene Route veroeffentlicht.
//
// Schutz des Endpunkts: Jeder Aufruf kostet Gemini-Kontingent. Ohne Bremse
// koennte jeder, der die URL kennt, das Kontingent leerlaufen lassen. Daher:
//   - Eingaben streng pruefen (Zahlen, Wertebereich, Laenge des Ortsnamens),
//   - Ortsnamen saeubern, bevor er in den Prompt kommt (Prompt-Injection),
//   - Aufrufe pro IP und insgesamt pro Tag begrenzen.
// Das Limit liegt im Speicher und gilt je Server-Instanz. Auf Vercel kann es
// mehrere Instanzen geben - es ist eine Bremse, keine harte Abrechnungsgrenze.
import { GoogleGenAI, Type } from '@google/genai';

export type SafetyInput = { latitude: number; longitude: number; locationName: string };

export type ValidationResult =
  | { ok: true; value: SafetyInput }
  | { ok: false; error: string };

const MAX_NAME_LENGTH = 120;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Entfernt Steuerzeichen, Anfuehrungszeichen und Backticks und kuerzt den Namen. */
export function sanitizeLocationName(value: unknown): string {
  if (typeof value !== 'string') return 'Unbekannt';
  const clean = value
    .replace(/[\u0000-\u001f\u007f"`\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return clean || 'Unbekannt';
}

export function validateSafetyRequest(body: unknown): ValidationResult {
  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const latitude = toNumber(data.latitude);
  const longitude = toNumber(data.longitude);
  if (latitude === null || longitude === null) {
    return { ok: false, error: 'Coordinates are required' };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { ok: false, error: 'Coordinates out of range' };
  }
  return { ok: true, value: { latitude, longitude, locationName: sanitizeLocationName(data.locationName) } };
}

export type RateLimiterOptions = {
  perClient: number;
  windowMs: number;
  dailyTotal: number;
  now?: () => number;
};

export type RateDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** Gleitendes Fenster pro Client plus Tagesobergrenze fuer alle zusammen. */
export function createRateLimiter({ perClient, windowMs, dailyTotal, now = Date.now }: RateLimiterOptions) {
  const hits = new Map<string, number[]>();
  let dayStart = now();
  let dayCount = 0;
  const DAY = 24 * 60 * 60 * 1000;

  return function check(clientKey: string): RateDecision {
    const t = now();
    if (t - dayStart >= DAY) {
      dayStart = t;
      dayCount = 0;
    }
    if (dayCount >= dailyTotal) {
      return { allowed: false, retryAfterSeconds: Math.ceil((dayStart + DAY - t) / 1000) };
    }

    const recent = (hits.get(clientKey) ?? []).filter(ts => t - ts < windowMs);
    if (recent.length >= perClient) {
      hits.set(clientKey, recent);
      return { allowed: false, retryAfterSeconds: Math.ceil((recent[0] + windowMs - t) / 1000) };
    }
    recent.push(t);
    hits.set(clientKey, recent);
    dayCount++;

    // Speicher begrenzen: alte Eintraege gelegentlich wegraeumen.
    if (hits.size > 5000) {
      for (const [key, list] of hits) {
        if (list.every(ts => t - ts >= windowMs)) hits.delete(key);
      }
    }
    return { allowed: true };
  };
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Standard-Limiter: 10 Checks pro Stunde und IP, 300 pro Tag insgesamt (per Env anpassbar). */
export function createDefaultRateLimiter() {
  return createRateLimiter({
    perClient: envInt('SAFETY_CHECK_PER_HOUR', 10),
    windowMs: 60 * 60 * 1000,
    dailyTotal: envInt('SAFETY_CHECK_PER_DAY', 300),
  });
}

/** Client-Kennung aus x-forwarded-for (Vercel/Proxy) oder der Socket-Adresse. */
export function clientKeyFrom(headers: Record<string, string | string[] | undefined>, fallback?: string): string {
  const forwarded = headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || fallback || 'unbekannt';
}

export type SafetyResponse = { status: number; body: unknown; headers?: Record<string, string> };

let client: GoogleGenAI | null = null;
function getClient(apiKey: string): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  }
  return client;
}

function buildPrompt({ latitude, longitude, locationName }: SafetyInput): string {
  return `Analysiere den Drohnen-Flugort "${locationName}" bei den Koordinaten ${latitude}, ${longitude}.
      Identifiziere potenzielle Hindernisse für Drohnen (UAS), die nicht direkt auf einer Standardkarte oder dem dipul-Tool sichtbar sein könnten.
      Suche nach:
      - Lokalen Besonderheiten wie Mikroklima-Effekten (Fallwinde an Klippen)
      - Nicht kartierten Hindernissen wie Vogelschutzgebieten, die temporär aktiv sind
      - Privatsphäre-sensiblen Zonen wie Freibädern, Schulen oder exklusiven Wohnanlagen
      - Bekannten Störquellen für GPS oder Funk (Industriegebiete, Forschungszentren)
      - Hochspannungsmasten, die oft in Satellitenbildern schwer zu erkennen sind

      Antworte auf Deutsch und sei sehr präzise.`;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    obstacles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: 'Art des Hindernisses (z.B. Stromleitung, Privatgrundstück, Vogelschutz)' },
          severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High'], description: 'Einschätzung des Risikos' },
          description: { type: Type.STRING, description: 'Details zum Risiko an diesem Ort' },
          action: { type: Type.STRING, description: 'Empfohlene Vorsichtsmaßnahme für den Piloten' },
        },
        required: ['type', 'severity', 'description', 'action'],
      },
    },
    overall_safety_score: { type: Type.INTEGER, description: 'Sicherheits-Score von 1-100 basierend auf den Funden' },
    summary: { type: Type.STRING, description: 'Professionelle Einschätzung der Lage' },
  },
  required: ['obstacles', 'overall_safety_score', 'summary'],
};

/**
 * Kompletter Ablauf eines Checks: Limit -> Validierung -> Schluessel -> Gemini.
 * Gibt Status und Body zurueck, damit Express und Vercel dieselbe Logik teilen.
 */
export async function handleSafetyCheck(
  body: unknown,
  clientKey: string,
  limiter: (key: string) => RateDecision,
  apiKey: string | undefined = process.env.GEMINI_API_KEY,
): Promise<SafetyResponse> {
  const parsed = validateSafetyRequest(body);
  // 'in' statt .ok: das Projekt laeuft ohne strictNullChecks, dort engt .ok nicht ein.
  if ('error' in parsed) return { status: 400, body: { error: parsed.error } };

  if (!apiKey) {
    return { status: 503, body: { error: 'AI safety check is not configured on this server' } };
  }

  const decision = limiter(clientKey);
  if ('retryAfterSeconds' in decision) {
    return {
      status: 429,
      body: { error: 'Too many safety checks, please try again later' },
      headers: { 'Retry-After': String(decision.retryAfterSeconds) },
    };
  }

  try {
    const response = await getClient(apiKey).models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: buildPrompt(parsed.value),
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });
    return { status: 200, body: JSON.parse(response.text ?? '') };
  } catch (error) {
    console.error('Safety check error:', error);
    return { status: 500, body: { error: 'Failed to perform safety check' } };
  }
}
