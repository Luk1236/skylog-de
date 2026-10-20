import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createDefaultRateLimiter, handleSafetyCheck } from "./api/_lib/safetyCheck";
import { luftfahrtwetter, zonen, karte, sende } from "./api/_lib/proxys";

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

  // Proxys fuer den Browser (Luftfahrtwetter, Zonen, Offline-Karten). Logik und
  // Begruendung in api/_lib/proxys.ts - dieselbe nutzen die Vercel-Funktionen.
  app.get("/api/aviation/:art", async (req, res) => {
    const { ids, bbox } = req.query as { ids?: string; bbox?: string };
    sende(res, await luftfahrtwetter(req.params.art, ids, bbox));
  });
  app.get("/api/zonen/:land", async (req, res) => {
    sende(res, await zonen(req.params.land));
  });
  app.get("/api/karte/:datei", async (req, res) => {
    sende(res, await karte(req.params.datei, req.headers.range ? String(req.headers.range) : undefined));
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
