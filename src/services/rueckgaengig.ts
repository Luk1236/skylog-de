// „Gelöscht – Rückgängig“: statt vor dem Löschen zu fragen, wird sofort gelöscht
// und ein paar Sekunden lang eine Leiste zum Zurückholen gezeigt. Das geht
// schneller und verzeiht trotzdem Fehlgriffe.
//
// Wie dialog.ts ein imperativer Modul-Dienst; <HinweisLeiste> rendert ihn.

export interface RueckgaengigHinweis {
  id: number;
  text: string;
}

type Aktion = () => void | Promise<void>;

let aktuell: RueckgaengigHinweis | null = null;
let aktion: Aktion | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let listener: (() => void) | null = null;
let zaehler = 0;

export function abonniereHinweis(fn: () => void): () => void {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

export function aktuellerHinweis(): RueckgaengigHinweis | null {
  return aktuell;
}

/** Schließt die Leiste, ohne etwas zurückzuholen. */
export function schliesseHinweis(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  aktuell = null;
  aktion = null;
  listener?.();
}

/** Zeigt die Leiste. Ein neuer Hinweis ersetzt den alten (der bleibt gelöscht). */
export function zeigeRueckgaengig(text: string, rueckgaengig: Aktion, dauerMs = 6000): void {
  if (timer) clearTimeout(timer);
  aktuell = { id: ++zaehler, text };
  aktion = rueckgaengig;
  timer = setTimeout(schliesseHinweis, dauerMs);
  listener?.();
}

/** Holt das zuletzt Gelöschte zurück und schließt die Leiste. */
export async function fuehreRueckgaengigAus(): Promise<void> {
  const a = aktion;
  schliesseHinweis();
  await a?.();
}
