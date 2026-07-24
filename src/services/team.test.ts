import { describe, it, expect } from 'vitest';
import {
  rolleVon, vorgesehenFuer, lizenzStatus, teamUebersicht, teamKennzahlen, ROLLEN_NAMEN,
} from './team';
import type { Pilot, Flight } from './db';

function pilot(p: Partial<Pilot> & { id: string; name: string }): Pilot {
  return { eid: 'DE-OP-1', isGuest: false, createdAt: 0, ...p };
}
function flug(f: Partial<Flight> & { id: string }): Flight {
  return { date: '2026-01-01', duration: 10, ...f } as Flight;
}

const heute = new Date('2026-07-24T12:00:00Z');

describe('rolleVon', () => {
  it('nimmt die gesetzte Rolle', () => {
    expect(rolleVon(pilot({ id: '1', name: 'A', rolle: 'verantwortlicher' }))).toBe('verantwortlicher');
  });

  // Altbestand hat nur isGuest — ohne Rückfall stünde er ohne Einordnung da.
  it('leitet Altbestand ohne Rolle aus isGuest ab', () => {
    expect(rolleVon(pilot({ id: '1', name: 'A', isGuest: true }))).toBe('gast');
    expect(rolleVon(pilot({ id: '2', name: 'B', isGuest: false }))).toBe('pilot');
  });

  it('für jede Rolle gibt es einen Anzeigenamen', () => {
    for (const r of ['verantwortlicher', 'pilot', 'gast'] as const) {
      expect(ROLLEN_NAMEN[r]?.length).toBeGreaterThan(0);
    }
  });
});

describe('vorgesehenFuer', () => {
  it('nur der Verantwortliche verwaltet Team und fremde Flüge', () => {
    expect(vorgesehenFuer('verantwortlicher').teamVerwalten).toBe(true);
    expect(vorgesehenFuer('pilot').teamVerwalten).toBe(false);
    expect(vorgesehenFuer('gast').fremdeFluegeEintragen).toBe(false);
  });

  it('eigene Flüge darf jeder eintragen', () => {
    for (const r of ['verantwortlicher', 'pilot', 'gast'] as const) {
      expect(vorgesehenFuer(r).eigeneFluege).toBe(true);
    }
  });

  it('der Gast verwaltet die Flotte nicht', () => {
    expect(vorgesehenFuer('gast').flotteVerwalten).toBe(false);
    expect(vorgesehenFuer('pilot').flotteVerwalten).toBe(true);
  });
});

describe('lizenzStatus', () => {
  it('ohne Datum unbekannt statt geraten', () => {
    expect(lizenzStatus(pilot({ id: '1', name: 'A' }), heute).stufe).toBe('unbekannt');
    expect(lizenzStatus(pilot({ id: '1', name: 'A', lizenzAblauf: 'Unsinn' }), heute).stufe).toBe('unbekannt');
  });

  it('erkennt abgelaufen, auslaufend und gültig', () => {
    expect(lizenzStatus(pilot({ id: '1', name: 'A', lizenzAblauf: '2026-07-01' }), heute).stufe).toBe('abgelaufen');
    expect(lizenzStatus(pilot({ id: '2', name: 'B', lizenzAblauf: '2026-08-15' }), heute).stufe).toBe('laeuft-ab');
    expect(lizenzStatus(pilot({ id: '3', name: 'C', lizenzAblauf: '2027-06-01' }), heute).stufe).toBe('ok');
  });

  it('nennt die verbleibenden Tage', () => {
    const s = lizenzStatus(pilot({ id: '1', name: 'A', lizenzAblauf: '2026-08-15' }), heute);
    expect(s.tageBis).toBeGreaterThan(0);
    expect(s.tageBis).toBeLessThanOrEqual(60);
  });
});

describe('teamUebersicht', () => {
  const piloten = [
    pilot({ id: 'p1', name: 'Anna', rolle: 'pilot' }),
    pilot({ id: 'p2', name: 'Bernd', rolle: 'verantwortlicher' }),
    pilot({ id: 'p3', name: 'Gast', rolle: 'gast' }),
  ];
  const fluege = [
    flug({ id: 'f1', pilotId: 'p1', duration: 30, date: '2026-05-01' }),
    flug({ id: 'f2', pilotId: 'p1', duration: 45, date: '2026-06-10' }),
    flug({ id: 'f3', pilotId: 'p2', duration: 20, date: '2026-07-01' }),
    // Altbestand ohne pilotId — nur der Name verknuepft.
    flug({ id: 'f4', pilotName: 'Anna', duration: 15, date: '2026-02-02' }),
  ];

  it('zählt Flüge und Minuten je Pilot', () => {
    const u = teamUebersicht(piloten, fluege, heute);
    const anna = u.find((e) => e.pilot.id === 'p1')!;
    expect(anna.fluege).toBe(3);
    expect(anna.minuten).toBe(90);
  });

  // Ohne Namens-Rückfall sähe ein langjähriger Pilot wie ein Neuling aus.
  it('ordnet Altflüge ohne pilotId über den Namen zu', () => {
    const nurAlt = teamUebersicht([piloten[0]], [flug({ id: 'x', pilotName: 'Anna', duration: 12 })], heute);
    expect(nurAlt[0].fluege).toBe(1);
  });

  it('nennt den letzten Flug', () => {
    const u = teamUebersicht(piloten, fluege, heute);
    expect(u.find((e) => e.pilot.id === 'p1')!.letzterFlug).toBe('2026-06-10');
  });

  it('stellt Verantwortliche nach vorn, dann die aktivsten', () => {
    const u = teamUebersicht(piloten, fluege, heute);
    expect(u[0].pilot.name).toBe('Bernd');
    expect(u[u.length - 1].rolle).toBe('gast');
  });

  it('ein Pilot ohne Flüge steht mit Null da, nicht undefiniert', () => {
    const u = teamUebersicht(piloten, fluege, heute);
    const gast = u.find((e) => e.pilot.id === 'p3')!;
    expect(gast.fluege).toBe(0);
    expect(gast.minuten).toBe(0);
    expect(gast.letzterFlug).toBeUndefined();
  });
});

describe('teamKennzahlen', () => {
  it('summiert Piloten, Flüge und Stunden', () => {
    const u = teamUebersicht(
      [pilot({ id: 'p1', name: 'A' }), pilot({ id: 'p2', name: 'B' })],
      [flug({ id: 'f1', pilotId: 'p1', duration: 90 }), flug({ id: 'f2', pilotId: 'p2', duration: 30 })],
      heute
    );
    const k = teamKennzahlen(u);
    expect(k.piloten).toBe(2);
    expect(k.fluege).toBe(2);
    expect(k.stunden).toBe(2);
  });

  it('zählt abgelaufene und auslaufende Nachweise als Warnung', () => {
    const u = teamUebersicht(
      [
        pilot({ id: 'p1', name: 'A', lizenzAblauf: '2026-07-01' }),
        pilot({ id: 'p2', name: 'B', lizenzAblauf: '2026-08-10' }),
        pilot({ id: 'p3', name: 'C', lizenzAblauf: '2028-01-01' }),
      ],
      [],
      heute
    );
    expect(teamKennzahlen(u).lizenzWarnungen).toBe(2);
  });
});
