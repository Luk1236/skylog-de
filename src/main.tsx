import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ladeTheme, wendeAn } from './services/theme';
import { ErrorBoundary } from './components/ErrorBoundary';

// Theme vor dem ersten Render setzen, damit es nicht kurz hell aufblitzt.
wendeAn(ladeTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Service Worker selbst registrieren und Updates übernehmen lassen: Ein neuer
// Worker bekommt SKIP_WAITING, übernimmt die Seite und löst controllerchange
// aus. Dann einmal neu laden, damit HTML, CSS und JS aus demselben Build
// stammen. Ohne das blieb nach einem Update eine alte HTML/CSS-Kombination
// hängen (leere Seite, Karte im alten Zustand).
if ('serviceWorker' in navigator) {
  const hatteController = !!navigator.serviceWorker.controller;
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteController || neuGeladen) return;
    neuGeladen = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registrierung = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const uebernehmen = () => {
        if (registrierung.waiting && navigator.serviceWorker.controller) {
          registrierung.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      };
      registrierung.addEventListener('updatefound', () => {
        const neu = registrierung.installing;
        neu?.addEventListener('statechange', () => {
          if (neu.state === 'installed' && navigator.serviceWorker.controller) {
            neu.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
      uebernehmen();
      void registrierung.update();
    } catch {
      // Offline oder Browser ohne Service-Worker-Unterstützung.
    }
  });
}
