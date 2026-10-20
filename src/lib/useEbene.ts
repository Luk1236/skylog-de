import { useEffect, useRef } from 'react';
import { oeffneEbene } from '../services/ebenen';

/** Meldet eine Ebene (Dialog, Vollbild) an, solange `aktiv` ist, damit
 *  Android-Zurück und Escape sie schließen. `schliessen` darf sich bei jedem
 *  Rendern ändern - es zählt immer die neueste Fassung. */
export function useEbene(aktiv: boolean, schliessen: () => void): void {
  const aktuell = useRef(schliessen);
  useEffect(() => {
    aktuell.current = schliessen;
  });
  useEffect(() => {
    if (!aktiv) return;
    return oeffneEbene(() => aktuell.current());
  }, [aktiv]);
}
