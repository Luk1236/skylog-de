// Vercel-Funktion: amtliche Zonendatei eines Landes (nur gepruefte Quellen). Logik in _lib/proxys.ts.
import { zonen, sende, type Antwortobjekt } from '../_lib/proxys';

type Anfrage = { query: Record<string, string | string[] | undefined> };

export default async function handler(req: Anfrage, res: Antwortobjekt) {
  const land = req.query.land;
  sende(res, await zonen((Array.isArray(land) ? land[0] : land) ?? ''));
}
