// Team-Verwaltung: Rollen und Übersicht über mehrere Piloten.
//
// WICHTIG zur Einordnung: Diese App hat keine Benutzerkonten und keinen
// Server — alle Daten liegen lokal auf dem Gerät. Rollen sind hier deshalb
// eine ORGANISATORISCHE Angabe, keine technische Zugriffsbeschränkung. Wer das
// Gerät in der Hand hat, kann alles. Das ehrlich zu benennen ist wichtiger,
// als eine Sicherheit vorzugaukeln, die es nicht gibt; „darf()" beantwortet
// die Frage „wer ist wofür vorgesehen", nicht „wer kommt woran".

import type { Pilot, Flight } from './db';

export type Rolle = 'verantwortlicher' | 'pilot' | 'gast';

export const ROLLEN_NAMEN: Record<Rolle, string> = {
  verantwortlicher: 'Verantwortlicher',
  pilot: 'Pilot',
  gast: 'Gastpilot',
};

/** Rolle eines Piloten. Altbestand ohne Rolle wird aus isGuest abgeleitet,
 *  damit bestehende Einträge nicht plötzlich ohne Einordnung dastehen. */
export function rolleVon(pilot: Pilot): Rolle {
  if (pilot.rolle) return pilot.rolle;
  return pilot.isGuest ? 'gast' : 'pilot';
}

/** Wofür ist diese Rolle organisatorisch vorgesehen? Keine Zugriffskontrolle. */
export function vorgesehenFuer(rolle: Rolle): {
  eigeneFluege: boolean;
  fremdeFluegeEintragen: boolean;
  flotteVerwalten: boolean;
  teamVerwalten: boolean;
} {
  return {
    eigeneFluege: true,
    fremdeFluegeEintragen: rolle === 'verantwortlicher',
    flotteVerwalten: rolle !== 'gast',
    teamVerwalten: rolle === 'verantwortlicher',
  };
}

export interface LizenzStatus {
  stufe: 'ok' | 'laeuft-ab' | 'abgelaufen' | 'unbekannt';
  tageBis?: number;
}

/** Fernpilotennachweis-Status. 60 Tage Vorwarnung — genug Zeit für die
 *  Auffrischung, ohne monatelang zu mahnen. */
export function lizenzStatus(pilot: Pilot, heute: Date = new Date()): LizenzStatus {
  if (!pilot.lizenzAblauf) return { stufe: 'unbekannt' };
  const ende = new Date(pilot.lizenzAblauf);
  if (Number.isNaN(ende.getTime())) return { stufe: 'unbekannt' };
  const tage = Math.floor((ende.getTime() - heute.getTime()) / 86_400_000);
  if (tage < 0) return { stufe: 'abgelaufen', tageBis: tage };
  if (tage <= 60) return { stufe: 'laeuft-ab', tageBis: tage };
  return { stufe: 'ok', tageBis: tage };
}

export interface TeamEintrag {
  pilot: Pilot;
  rolle: Rolle;
  fluege: number;
  minuten: number;
  letzterFlug?: string;
  lizenz: LizenzStatus;
}

/** Übersicht über das Team: wer fliegt wie viel, wessen Nachweis läuft aus.
 *
 *  Flüge werden über pilotId zugeordnet; fehlt die (ältere Einträge), zählt
 *  der Name als Rückfall. Ohne diesen Rückfall sähe ein langjähriger Pilot
 *  plötzlich wie ein Neuling aus. */
export function teamUebersicht(
  piloten: Pilot[],
  fluege: Flight[],
  heute: Date = new Date()
): TeamEintrag[] {
  return piloten
    .map((p) => {
      const seine = fluege.filter(
        (f) => (f.pilotId && f.pilotId === p.id) || (!f.pilotId && f.pilotName === p.name)
      );
      const minuten = seine.reduce((s, f) => s + (Number(f.duration) || 0), 0);
      const letzter = seine
        .map((f) => f.date)
        .filter(Boolean)
        .sort()
        .pop();
      return {
        pilot: p,
        rolle: rolleVon(p),
        fluege: seine.length,
        minuten,
        letzterFlug: letzter,
        lizenz: lizenzStatus(p, heute),
      };
    })
    // Verantwortliche zuerst, dann nach Flugstunden — die aktivsten oben.
    .sort((a, b) => {
      const rang = (r: Rolle) => (r === 'verantwortlicher' ? 0 : r === 'pilot' ? 1 : 2);
      const d = rang(a.rolle) - rang(b.rolle);
      return d !== 0 ? d : b.minuten - a.minuten;
    });
}

/** Kurzfassung fürs Team-Dashboard. */
export function teamKennzahlen(eintraege: TeamEintrag[]): {
  piloten: number;
  fluege: number;
  stunden: number;
  lizenzWarnungen: number;
} {
  return {
    piloten: eintraege.length,
    fluege: eintraege.reduce((s, e) => s + e.fluege, 0),
    stunden: Math.round(eintraege.reduce((s, e) => s + e.minuten, 0) / 60),
    lizenzWarnungen: eintraege.filter(
      (e) => e.lizenz.stufe === 'abgelaufen' || e.lizenz.stufe === 'laeuft-ab'
    ).length,
  };
}
