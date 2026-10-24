import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createDefaultRateLimiter, handleSafetyCheck, herkunftErlaubt } from "./api/_lib/safetyCheck";
import { ASSET_CACHE, SICHERHEITS_HEADER } from "./api/_lib/sicherheitsHeader";
import { luftfahrtwetter, zonen, karte, sende } from "./api/_lib/proxys";

dotenv.config();

const safetyLimiter = createDefaultRateLimiter();

async function startServer() {
  const app = express();
  // Hoster wie Render/Railway geben den Port vor; lokal bleibt es 3000.
  const PORT = Number(process.env.PORT) || 3000;

  // `npm start` (node dist-server/server.cjs) soll auch ohne gesetztes
  // NODE_ENV die gebaute Fassung ausliefern. `npm run dev` (tsx server.ts)
  // bleibt der Entwicklungsserver.
  const istProduktion = process.env.NODE_ENV === "production" || /server\.cjs$/.test(process.argv[1] ?? "");

  app.use(express.json({ limit: "10kb" }));

  // Sicherheits-Header wie in vercel.json - nur im Produktionsbetrieb: Der
  // Vite-Entwicklungsserver braucht Inline-Skripte (React Refresh).
  if (istProduktion) {
    app.use((_req, res, next) => {
      for (const [name, wert] of Object.entries(SICHERHEITS_HEADER)) res.setHeader(name, wert);
      next();
    });
  }

  // KI-Sicherheitscheck. Validierung, Rate-Limit und Gemini-Aufruf teilen sich
  // server.ts und api/safety-check.ts (Vercel) in api/_lib/safetyCheck.ts.
  // Bewusst req.socket statt x-forwarded-for: ohne vorgeschalteten Proxy
  // koennte ein Client den Header faelschen und das Pro-IP-Limit umgehen.
  app.post("/api/safety-check", async (req, res) => {
    if (!herkunftErlaubt(req.headers.origin, req.headers.host)) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
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

  // Vite nur im Entwicklungsbetrieb laden: So läuft die gebaute Fassung auch
  // mit `npm ci --omit=dev` (Vite ist eine Dev-Abhängigkeit).
  if (!istProduktion) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      // Vite-Dateien tragen einen Hash im Namen: dürfen ein Jahr im Cache bleiben.
      setHeaders: (res, datei) => {
        if (datei.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", ASSET_CACHE);
      },
    }));
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
