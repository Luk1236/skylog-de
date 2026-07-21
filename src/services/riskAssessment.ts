// Betriebskategorie-Check nach EU-Verordnung 2019/947 (Open-Kategorie
// A1/A2/A3 gegenüber Specific). Bewusst eine ORIENTIERUNGSHILFE, kein
// rechtsverbindliches SORA — die Verantwortung bleibt beim Piloten.
// Reine Entscheidungslogik, ohne Netz und Seiteneffekte.

export type Szenario =
  | 'ueber_unbeteiligten'   // wird über unbeteiligte Personen geflogen
  | 'nahe_unbeteiligten'    // Unbeteiligte in der Nähe, aber nicht überflogen
  | 'keine_unbeteiligten';  // keine unbeteiligten Personen im Bereich

export interface RisikoEingabe {
  uasClass: string;          // C0..C4, Legacy, Self-built
  weight: number;            // Gramm
  szenario: Szenario;
  menschenansammlung: boolean;  // Flug über Menschenansammlung
  inBebautemGebiet: boolean;    // Wohn-/Gewerbe-/Industrie-/Erholungsgebiet
  hoehe: number;             // m über Grund
  vlos: boolean;             // in Sichtweite
}

export type Kategorie = 'A1' | 'A2' | 'A3' | 'Specific';

export interface RisikoErgebnis {
  kategorie: Kategorie;
  imOpen: boolean;
  /** Warum die Open-Kategorie gesprengt wird (nur bei Specific). */
  gruende: string[];
  /** Auflagen/Bedingungen der ermittelten Unterkategorie. */
  anforderungen: string[];
  /** Verstöße gegen die ermittelte Unterkategorie (rot). */
  verstoesse: string[];
  kompetenz: string;
}

// grobe Klassenzuordnung anhand Klasse ODER Gewicht (Legacy/Selbstbau).
function istUnter250(e: RisikoEingabe): boolean {
  return e.uasClass === 'C0' || e.weight < 250;
}
function istC1(e: RisikoEingabe): boolean {
  return e.uasClass === 'C1' || (e.weight >= 250 && e.weight < 900);
}
function istC2(e: RisikoEingabe): boolean {
  return e.uasClass === 'C2' || (e.weight >= 900 && e.weight < 4000);
}

export function bewerteBetrieb(e: RisikoEingabe): RisikoErgebnis {
  const gruende: string[] = [];

  // Harte Grenzen der Open-Kategorie -> sonst Specific.
  if (e.weight >= 25000) gruende.push('Startmasse ab 25 kg — außerhalb der Open-Kategorie.');
  if (!e.vlos) gruende.push('Kein Flug in Sichtweite (VLOS) — Open verlangt VLOS.');
  if (e.hoehe > 120) gruende.push('Flughöhe über 120 m — Open-Grenze überschritten.');
  if (e.menschenansammlung) gruende.push('Flug über Menschenansammlungen ist in Open nie erlaubt.');

  if (gruende.length > 0) {
    return {
      kategorie: 'Specific',
      imOpen: false,
      gruende,
      anforderungen: [
        'Betriebsgenehmigung der zuständigen Behörde (LBA) erforderlich,',
        'oder Betrieb nach einem Standardszenario (STS-01 / STS-02) mit Erklärung.',
      ],
      verstoesse: [],
      kompetenz: 'Fernpilotenzeugnis (A2) plus szenariospezifische Anforderungen.',
    };
  }

  const anforderungen: string[] = [];
  const verstoesse: string[] = [];

  // Unterkategorie anhand der Drohnenklasse.
  if (istUnter250(e)) {
    // A1 mit C0/<250 g: Überflug Unbeteiligter erlaubt (keine Ansammlung).
    anforderungen.push('A1: Überflug einzelner Unbeteiligter zulässig, Menschenansammlungen meiden.');
    return {
      kategorie: 'A1', imOpen: true, gruende: [], anforderungen, verstoesse,
      kompetenz: 'Kein Nachweis nötig (unter 250 g); Registrierung ab Kamera empfohlen.',
    };
  }

  if (istC1(e)) {
    anforderungen.push('A1: kein absichtlicher Überflug Unbeteiligter, kurzer Überflug tolerierbar.');
    if (e.szenario === 'ueber_unbeteiligten') {
      verstoesse.push('C1 darf nicht gezielt über Unbeteiligte fliegen — Route anpassen.');
    }
    return {
      kategorie: 'A1', imOpen: true, gruende: [], anforderungen, verstoesse,
      kompetenz: 'EU-Kompetenznachweis A1/A3 (Online-Test).',
    };
  }

  if (istC2(e)) {
    // A2: 30 m Abstand zu Unbeteiligten (5 m im Langsamflug), A2-Zeugnis.
    anforderungen.push('A2: mind. 30 m Abstand zu Unbeteiligten (5 m im Langsamflug-Modus).');
    if (e.szenario === 'ueber_unbeteiligten') {
      verstoesse.push('In A2 kein Überflug Unbeteiligter — Abstand herstellen.');
    }
    return {
      kategorie: 'A2', imOpen: true, gruende: [], anforderungen, verstoesse,
      kompetenz: 'EU-Fernpilotenzeugnis A2 erforderlich.',
    };
  }

  // C3/C4/schwerer Legacy -> A3.
  anforderungen.push('A3: 150 m Abstand zu Wohn-/Gewerbe-/Industrie-/Erholungsgebieten.');
  anforderungen.push('A3: keine Unbeteiligten im Betriebsbereich.');
  if (e.szenario !== 'keine_unbeteiligten') {
    verstoesse.push('In A3 dürfen keine Unbeteiligten im Bereich sein.');
  }
  if (e.inBebautemGebiet) {
    verstoesse.push('A3 verlangt 150 m Abstand zu bebauten/Erholungsgebieten.');
  }
  return {
    kategorie: 'A3', imOpen: true, gruende: [], anforderungen, verstoesse,
    kompetenz: 'EU-Kompetenznachweis A1/A3 (Online-Test).',
  };
}
