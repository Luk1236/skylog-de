// App-eigener Ersatz für window.alert / window.confirm.
//
// Warum nicht die eingebauten: alert/confirm sehen auf dem Handy fremd aus,
// blockieren den Thread und lassen sich nicht ins App-Design einpassen. Dieser
// Dienst stellt dieselbe Bequemlichkeit bereit — bestaetige(text) liefert ein
// Promise<boolean> —, rendert aber über <DialogHost> einen Dialog im App-Stil.
//
// Bewusst ein imperativer Modul-Dienst statt React-Context: So lässt er sich
// auch tief in Unterkomponenten aufrufen (await bestaetige(...)), ohne durch
// jede Ebene ein Prop oder einen Context zu reichen. Der Host abonniert die
// aktuelle Anfrage und rendert sie; Anfragen werden nacheinander abgearbeitet.

export interface DialogAnfrage {
  art: 'melden' | 'bestaetigen';
  text: string;
  titel?: string;
  /** Roter Bestätigen-Knopf mit „Löschen“-Beschriftung — für unumkehrbare
   *  Aktionen wie Löschen. */
  gefaehrlich?: boolean;
}

type MitId = DialogAnfrage & { id: number };
type Aufloeser = (ok: boolean) => void;

let aktuelle: MitId | null = null;
let aufloesenAktuell: Aufloeser | null = null;
const warteschlange: { anfrage: MitId; aufloesen: Aufloeser }[] = [];
let listener: (() => void) | null = null;
let zaehler = 0;

/** Der Host abonniert Änderungen; useSyncExternalStore ruft das hier auf. */
export function abonniereDialog(fn: () => void): () => void {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

/** Aktuell anzuzeigende Anfrage (oder null). Stabile Referenz je Anfrage,
 *  damit useSyncExternalStore nicht in eine Schleife läuft. */
export function aktuelleAnfrage(): MitId | null {
  return aktuelle;
}

function zeigeNaechste(): void {
  if (aktuelle) return;
  const n = warteschlange.shift();
  if (n) {
    aktuelle = n.anfrage;
    aufloesenAktuell = n.aufloesen;
  }
  listener?.();
}

/** Kern: stellt eine Anfrage in die Schlange und liefert ein Promise. */
export function frageDialog(anfrage: DialogAnfrage): Promise<boolean> {
  return new Promise((resolve) => {
    warteschlange.push({ anfrage: { ...anfrage, id: ++zaehler }, aufloesen: resolve });
    zeigeNaechste();
  });
}

/** Der Host meldet die Antwort zurück; löst das Promise und zeigt die nächste. */
export function antworteDialog(ok: boolean): void {
  const aufloesen = aufloesenAktuell;
  aktuelle = null;
  aufloesenAktuell = null;
  aufloesen?.(ok);
  listener?.();
  zeigeNaechste();
}

/** Ja/Nein-Rückfrage. `await bestaetige('… wirklich löschen?', { gefaehrlich: true })`. */
export function bestaetige(text: string, opt?: { titel?: string; gefaehrlich?: boolean }): Promise<boolean> {
  return frageDialog({ art: 'bestaetigen', text, titel: opt?.titel, gefaehrlich: opt?.gefaehrlich });
}

/** Reine Meldung mit einem OK-Knopf. Kein await nötig, wenn danach nur
 *  zurückgekehrt wird. */
export function melde(text: string, titel?: string): Promise<boolean> {
  return frageDialog({ art: 'melden', text, titel });
}
