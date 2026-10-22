import { useSyncExternalStore } from 'react';

// Der Dunkelmodus steht als data-theme am <html> (services/theme.ts). Dieser Hook
// folgt dem Attribut, damit z.B. die Offline-Karte ihren Stil mitwechselt.
const istDunkel = () => document.documentElement.dataset.theme === 'dark';

function abonniere(melde: () => void): () => void {
  const beobachter = new MutationObserver(melde);
  beobachter.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => beobachter.disconnect();
}

export function useDunkelmodus(): boolean {
  return useSyncExternalStore(abonniere, istDunkel, () => false);
}
