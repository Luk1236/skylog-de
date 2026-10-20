// Vercel-Funktion: Offline-Kartendateien mit Range-Unterstuetzung. Logik in _lib/proxys.ts.
import { karte, sende, type Antwortobjekt } from '../_lib/proxys';

type Anfrage = {
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

export default async function handler(req: Anfrage, res: Antwortobjekt) {
  const datei = req.query.datei;
  const range = req.headers.range;
  sende(res, await karte((Array.isArray(datei) ? datei[0] : datei) ?? '', Array.isArray(range) ? range[0] : range));
}
