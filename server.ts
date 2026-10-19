import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createDefaultRateLimiter, handleSafetyCheck } from "./api/_lib/safetyCheck";
import { ZONEN_QUELLEN } from "./src/services/euZones";

dotenv.config();

const safetyLimiter = createDefaultRateLimiter();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10kb" }));

  // KI-Sicherheitscheck. Validierung, Rate-Limit und Gemini-Aufruf teilen sich
  // server.ts und api/safety-check.ts (Vercel) in api/_lib/safetyCheck.ts.
  // Bewusst req.socket statt x-forwarded-for: ohne vorgeschalteten Proxy
  // koennte ein Client den Header faelschen und das Pro-IP-Limit umgehen.
  app.post("/api/safety-check", async (req, res) => {
    const result = await handleSafetyCheck(req.body, req.socket.remoteAddress ?? "unbekannt", safetyLimiter);
    for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
    res.status(result.status).json(result.body);
  });

  // Proxy für Luftfahrtwetter (aviationweather.gov / NOAA).
  // Nötig, weil der Dienst KEINE CORS-Header sendet — ein direkter Aufruf aus
  // dem Browser wird blockiert. In der Android-App läuft der Aufruf dagegen
  // nativ über CapacitorHttp und braucht diesen Proxy nicht.
  // Der Dienst antwortet nur mit gesetztem User-Agent.
  app.get("/api/aviation/:art", async (req, res) => {
    const art = req.params.art === "taf" ? "taf" : "metar";
    const { ids, bbox } = req.query as { ids?: string; bbox?: string };
    if (!ids && !bbox) {
      return res.status(400).json({ error: "ids oder bbox erforderlich" });
    }
    const params = new URLSearchParams({ format: "json" });
    if (ids) params.set("ids", ids);
    if (bbox) params.set("bbox", bbox);
    try {
      const antwort = await fetch(`https://aviationweather.gov/api/data/${art}?${params}`, {
        headers: { "User-Agent": "SkyLog-DE/1.0" },
      });
      if (!antwort.ok) {
        return res.status(antwort.status).json({ error: `Wetterdienst antwortete mit ${antwort.status}` });
      }
      res.json(await antwort.json());
    } catch (error) {
      console.error("Aviation weather error:", error);
      res.status(502).json({ error: "Luftfahrtwetter nicht erreichbar" });
    }
  });

  // Zonen-Proxy fuer den Browser.
  //
  // Die Schweiz sendet Access-Control-Allow-Origin: * und braucht ihn nicht;
  // Luxemburg schickt keine CORS-Header. Nativ ist beides egal (CapacitorHttp).
  // Die erlaubten Ziele kommen aus ZONEN_QUELLEN (nur gepruefte Adressen) - eine
  // frei waehlbare Ziel-URL waere ein offener Weiterleitungsdienst.
  //
  // Antwortet die Quelle nicht mit JSON, gibt es einen ehrlichen Fehler. Frueher
  // wurde hier eine "amtliche" Ersatzzone erfunden - das darf nie wieder passieren.
  app.get("/api/zonen/:land", async (req, res) => {
    const code = String(req.params.land).toUpperCase();
    const ziel = ZONEN_QUELLEN.find(q => q.code === code)?.direktUrl;
    if (!ziel) return res.status(404).json({ error: "Fuer dieses Land ist keine Direktquelle hinterlegt" });
    try {
      const antwort = await fetch(ziel, { redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (!antwort.ok) {
        return res.status(502).json({ error: `Quelle antwortete mit ${antwort.status}` });
      }
      const text = await antwort.text();
      try {
        JSON.parse(text.replace(/^\uFEFF/, ""));
      } catch {
        return res.status(502).json({ error: "Quelle lieferte keine JSON-Daten" });
      }
      res.setHeader("content-type", "application/json");
      res.send(text);
    } catch (error) {
      console.warn(`Zonen-Proxy: Quelle fuer ${code} nicht erreichbar:`, error);
      res.status(502).json({ error: "Quelle nicht erreichbar" });
    }
  });

  // Karten-Proxy fuer den Browser.
  //
  // Die PMTiles-Regionsdateien liegen als GitHub-Release-Assets. GitHub
  // unterstuetzt HTTP-Range (geprueft: 206 + Accept-Ranges), sendet aber KEINE
  // CORS-Header - im Browser blockt der Abruf daher. Nativ ist das egal, weil
  // CapacitorHttp am Browser vorbei geht; fuer die Web-Version proxen wir.
  //
  // Der Range-Header MUSS durchgereicht und der 206-Status erhalten bleiben,
  // sonst laedt PMTiles jedes Mal die ganze Datei statt weniger Kilobytes.
  app.get("/api/karte/:datei", async (req, res) => {
    const datei = req.params.datei;
    if (!/^[a-z0-9-]+\.pmtiles$/i.test(datei)) {
      return res.status(400).json({ error: "Ungueltiger Dateiname" });
    }
    const ziel = `https://github.com/Luk1236/skylog-de/releases/download/karten-v1/${datei}`;
    try {
      const kopf: Record<string, string> = {};
      if (req.headers.range) kopf["Range"] = String(req.headers.range);

      const antwort = await fetch(ziel, { headers: kopf, redirect: "follow" });
      res.status(antwort.status);
      for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
        const wert = antwort.headers.get(name);
        if (wert) res.setHeader(name, wert);
      }
      if (!antwort.body) return res.end();
      const puffer = Buffer.from(await antwort.arrayBuffer());
      res.end(puffer);
    } catch (error) {
      console.error("Karten-Proxy Fehler:", error);
      res.status(502).json({ error: "Karte nicht erreichbar" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 5: Platzhalter muessen benannt sein ('*' allein ist ungueltig).
    app.get('/{*pfad}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
