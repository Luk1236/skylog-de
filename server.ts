import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Safety Analysis
  app.post("/api/safety-check", async (req, res) => {
    try {
      const { latitude, longitude, locationName } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Coordinates are required" });
      }

      const prompt = `Analysiere den Drohnen-Flugort "${locationName || 'Unbekannt'}" bei den Koordinaten ${latitude}, ${longitude}. 
      Identifiziere potenzielle Hindernisse für Drohnen (UAS), die nicht direkt auf einer Standardkarte oder dem dipul-Tool sichtbar sein könnten. 
      Suche nach:
      - Lokalen Besonderheiten wie Mikroklima-Effekten (Fallwinde an Klippen)
      - Nicht kartierten Hindernissen wie Vogelschutzgebieten, die temporär aktiv sind
      - Privatsphäre-sensiblen Zonen wie Freibädern, Schulen oder exklusiven Wohnanlagen
      - Bekannten Störquellen für GPS oder Funk (Industriegebiete, Forschungszentren)
      - Hochspannungsmasten, die oft in Satellitenbildern schwer zu erkennen sind
      
      Antworte auf Deutsch und sei sehr präzise.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              obstacles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: "Art des Hindernisses (z.B. Stromleitung, Privatgrundstück, Vogelschutz)" },
                    severity: { type: Type.STRING, enum: ["Low", "Medium", "High"], description: "Einschätzung des Risikos" },
                    description: { type: Type.STRING, description: "Details zum Risiko an diesem Ort" },
                    action: { type: Type.STRING, description: "Empfohlene Vorsichtsmaßnahme für den Piloten" }
                  },
                  required: ["type", "severity", "description", "action"]
                }
              },
              overall_safety_score: { type: Type.INTEGER, description: "Sicherheits-Score von 1-100 basierend auf den Funden" },
              summary: { type: Type.STRING, description: "Professionelle Einschätzung der Lage" }
            },
            required: ["obstacles", "overall_safety_score", "summary"]
          }
        },
      });

      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error("Safety check error:", error);
      res.status(500).json({ error: "Failed to perform safety check" });
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
