// Vercel Serverless Function — mirrors the /api/safety-check route from server.ts.
// This is what makes the AI safety check work on a static/serverless host (Vercel),
// where the long-running Express server (server.ts) does not run.
// The GEMINI_API_KEY stays server-side and is never shipped to the browser.
// Validierung, Rate-Limit und Gemini-Aufruf liegen gemeinsam in _lib/safetyCheck.ts.
import { clientKeyFrom, createDefaultRateLimiter, handleSafetyCheck } from './_lib/safetyCheck';

// Lebt so lange wie die (warme) Funktions-Instanz.
const limiter = createDefaultRateLimiter();

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};
type VercelResponse = {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await handleSafetyCheck(req.body, clientKeyFrom(req.headers, req.socket?.remoteAddress), limiter);
  for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
  return res.status(result.status).json(result.body);
}
