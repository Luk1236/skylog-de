// Offene Ebenen (Dialoge, Vollbild-Ansichten, Bild-Vollansicht) in der
// Reihenfolge, in der sie aufgegangen sind. Die Android-Zurück-Taste und
// Escape schließen immer nur die oberste Ebene.
//
// Vorher schloss Escape alle Dialoge auf einmal, und die Zurück-Taste beendete
// auf Android die ganze App - samt laufendem Flug-Timer.

type Schliessen = () => void;

const stapel: { id: number; schliessen: Schliessen }[] = [];
let zaehler = 0;

/** Meldet eine geöffnete Ebene an. Rückgabe: Abmelden (beim Schließen aufrufen). */
export function oeffneEbene(schliessen: Schliessen): () => void {
  const id = ++zaehler;
  stapel.push({ id, schliessen });
  return () => {
    const i = stapel.findIndex(e => e.id === id);
    if (i >= 0) stapel.splice(i, 1);
  };
}

/** Schließt die oberste Ebene. false, wenn keine offen ist. */
export function schliesseOberste(): boolean {
  const oben = stapel[stapel.length - 1];
  if (!oben) return false;
  oben.schliessen();
  return true;
}

export function anzahlEbenen(): number {
  return stapel.length;
}
