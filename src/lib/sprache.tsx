// Sprach-Context.
//
// Warum überhaupt: `uebersetze` ist eine reine Funktion, aber die Sprache liegt
// als State in <App>. Ohne Context müsste sie durch jede View als Prop gereicht
// werden — das war der Grund, warum bisher nur Kopfzeile und Navigation
// übersetzt waren und ein Teil des Wörterbuchs unbenutzt herumlag.
//
// Der Context liefert bewusst NUR t() und die Sprache. Das Umschalten bleibt in
// <App>, damit es genau eine Stelle gibt, die localStorage und <html lang>
// schreibt.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { uebersetze, type Sprache } from '../services/i18n';

interface SprachKontext {
  sprache: Sprache;
  t: (key: string) => string;
}

// Fallback Deutsch: Wird eine Komponente ausserhalb des Providers gerendert
// (z.B. in einem Test), uebersetzt sie weiter statt zu werfen.
const Kontext = createContext<SprachKontext>({
  sprache: 'de',
  t: (key: string) => uebersetze(key, 'de'),
});

export function SprachProvider({ sprache, children }: { sprache: Sprache; children: ReactNode }) {
  const wert = useMemo<SprachKontext>(
    () => ({ sprache, t: (key: string) => uebersetze(key, sprache) }),
    [sprache]
  );
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

/** Liefert t() und die aktive Sprache. In jeder Komponente unterhalb von <App>. */
export function useSprache(): SprachKontext {
  return useContext(Kontext);
}
