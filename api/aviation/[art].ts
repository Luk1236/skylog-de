// Vercel-Funktion: Luftfahrtwetter (METAR/TAF) fuer die Web-Version. Logik in _lib/proxys.ts.
import { luftfahrtwetter, sende, type Antwortobjekt } from '../_lib/proxys';

type Anfrage = { query: Record<string, string | string[] | undefined> };
const eins = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function handler(req: Anfrage, res: Antwortobjekt) {
  sende(res, await luftfahrtwetter(eins(req.query.art) ?? 'metar', eins(req.query.ids), eins(req.query.bbox)));
}
