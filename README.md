<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/89b41fe0-37c9-40a0-89d5-a4282c8a5a9f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env` (or `.env.local`) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy

Die App hat zwei Teile: das statische Frontend **und** eine kleine Server-Funktion für den KI-Sicherheitscheck (`/api/safety-check`). Wähle je nachdem, ob du die KI online brauchst:

### Option A — Vercel (empfohlen, KI funktioniert)
1. Repo auf [vercel.com](https://vercel.com) importieren.
2. Environment Variable `GEMINI_API_KEY` in den Vercel-Projekteinstellungen setzen.
3. Deploy. Vercel baut das Frontend (`vite build`) und stellt `api/safety-check.ts` automatisch als Serverless-Funktion bereit (siehe `vercel.json`).

### Option B — GitHub Pages (nur statisch, **ohne** KI)
Der Workflow unter `.github/workflows/deploy.yml` veröffentlicht nur das statische Frontend. Karte, Logbuch, Garage, Wetter usw. funktionieren — der **KI-Sicherheitscheck nicht** (dafür fehlt der Server). Die App zeigt in dem Fall einen freundlichen Hinweis statt eines Fehlers.

> **Wichtig:** Der `GEMINI_API_KEY` bleibt immer server-seitig und wird nie an den Browser ausgeliefert.
