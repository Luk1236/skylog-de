import type { Drone, UserProfile } from './db';

// Unterkategorie der offenen Kategorie nach DVO (EU) 2019/947, Anhang Teil A.
// Die Übergangsregel für Bestandsdrohnen (bis 500 g in A1, bis 2 kg mit 50 m
// Abstand) ist am 1.1.2024 ausgelaufen: Bestandsdrohnen ab 250 g fliegen
// seitdem nur noch in A3.

export type OffeneKategorie = 'A1' | 'A2' | 'A3';

/** Was die Unterkategorie für unbeteiligte Personen bedeutet. */
export type AbstandsRegel =
  | 'ueberflugErlaubt'     // A1 mit C0 oder unter 250 g
  | 'ueberflugVermeiden'   // A1 mit C1
  | 'abstand30'            // A2 mit C2 und A2-Zeugnis
  | 'abstand150';          // A3

export interface KategorieErgebnis {
  kategorie: OffeneKategorie;
  regel: AbstandsRegel;
  /** Bestandsdrohne ab 250 g - früher A1, seit 2024 nur A3. */
  bestandAb250: boolean;
}

/** Unterkategorie der offenen Kategorie für Drohne und Kompetenznachweis.
 *  Das Gewicht steht in Gramm (so fragt es das Drohnen-Formular ab); fehlt es,
 *  wird vorsichtig wie bei „ab 250 g“ gerechnet. */
export function offeneKategorie(drohne: Pick<Drone, 'uasClass' | 'weight'>, lizenz?: UserProfile['licenseType']): KategorieErgebnis {
  const klasse = drohne.uasClass || 'Legacy';
  const ohneKlasse = klasse === 'Legacy' || klasse === 'Self-built';
  const unter250 = typeof drohne.weight === 'number' && drohne.weight > 0 && drohne.weight < 250;

  if (klasse === 'C0' || (ohneKlasse && unter250)) return { kategorie: 'A1', regel: 'ueberflugErlaubt', bestandAb250: false };
  if (klasse === 'C1') return { kategorie: 'A1', regel: 'ueberflugVermeiden', bestandAb250: false };
  if (klasse === 'C2' && lizenz === 'A2') return { kategorie: 'A2', regel: 'abstand30', bestandAb250: false };
  return { kategorie: 'A3', regel: 'abstand150', bestandAb250: klasse === 'Legacy' && !unter250 };
}
