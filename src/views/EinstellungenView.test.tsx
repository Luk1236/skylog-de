// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EinstellungenView } from './EinstellungenView';

// Einspielen einer Sicherung im Modus „Ersetzen“: erst Vorschau und Rückfrage,
// dann Sicherheitskopie der aktuellen Daten, erst danach ersetzen (Idee E19).
const ablauf = vi.hoisted(() => ({ schritte: [] as string[], antwort: true, kopieKlappt: true }));

vi.mock('../services/dialog', () => ({
  bestaetige: vi.fn(async (text: string) => { ablauf.schritte.push(`frage: ${text}`); return ablauf.antwort; }),
  melde: vi.fn(async (text: string) => { ablauf.schritte.push(`meldung: ${text}`); return true; }),
}));

vi.mock('../services/backup', async (original) => ({
  ...await original<typeof import('../services/backup')>(),
  leseSicherung: vi.fn(async () => {
    ablauf.schritte.push('gelesen');
    return {
      app: 'SkyLog DE', version: 2, exportedAt: '2026-10-20T08:00:00Z',
      drones: [{ id: 'd1' }], flights: [{ id: 'f1', date: '2026-05-03' }, { id: 'f2', date: '2026-10-21' }],
      batteries: [], maintenance: [], pilots: [], profile: null, documents: [],
    };
  }),
  sichereVorDemErsetzen: vi.fn(async () => {
    if (!ablauf.kopieKlappt) throw new Error('Teilen abgebrochen');
    ablauf.schritte.push('kopie');
    return 'skylog_vor_wiederherstellung_2026-10-22.json';
  }),
  importBackup: vi.fn(async (_d: File, modus: string) => {
    ablauf.schritte.push(`eingespielt: ${modus}`);
    return { drones: 1, flights: 2, batteries: 0, maintenance: 0, pilots: 0, documents: 0, profile: false, weitere: 0 };
  }),
}));

vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => { ablauf.schritte = []; ablauf.antwort = true; ablauf.kopieKlappt = true; });
afterEach(() => cleanup());

const ansicht = () => render(
  <EinstellungenView profile={null} onUpdate={vi.fn()} onOpenPinSetup={vi.fn()} onOpenDatensicherung={vi.fn()}
    sprache="de" onSprache={vi.fn()} theme="light" onTheme={vi.fn()} />,
);

const waehleDatei = () => {
  const eingabe = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(eingabe, { target: { files: [new File(['{}'], 'sicherung.json', { type: 'application/json' })] } });
};

describe('Einstellungen: Sicherung einspielen', () => {
  it('Ersetzen zeigt den Inhalt, legt eine Sicherheitskopie an und ersetzt erst dann', async () => {
    ansicht();
    waehleDatei();
    fireEvent.click(screen.getByRole('button', { name: /Ersetzen/ }));
    await vi.waitFor(() => expect(ablauf.schritte.some(s => s.startsWith('meldung'))).toBe(true));
    const [gelesen, frage, kopie, eingespielt, meldung] = ablauf.schritte;
    expect([gelesen, kopie, eingespielt]).toEqual(['gelesen', 'kopie', 'eingespielt: replace']);
    expect(frage).toMatch(/2 Flüge \(03\.05\.2026 – 21\.10\.2026\), 1 Drohnen/);
    expect(frage).toMatch(/Sicherheitskopie/);
    expect(meldung).toMatch(/skylog_vor_wiederherstellung_2026-10-22\.json/);
  });

  it('bricht bei „Abbrechen“ ab, ohne Kopie und ohne Einspielen', async () => {
    ablauf.antwort = false;
    ansicht();
    waehleDatei();
    fireEvent.click(screen.getByRole('button', { name: /Ersetzen/ }));
    await vi.waitFor(() => expect(ablauf.schritte.some(s => s.startsWith('frage'))).toBe(true));
    expect(ablauf.schritte).not.toContain('kopie');
    expect(ablauf.schritte.some(s => s.startsWith('eingespielt'))).toBe(false);
  });

  it('ersetzt nichts, wenn die Sicherheitskopie scheitert', async () => {
    ablauf.kopieKlappt = false;
    ansicht();
    waehleDatei();
    fireEvent.click(screen.getByRole('button', { name: /Ersetzen/ }));
    await vi.waitFor(() => expect(ablauf.schritte.some(s => s.startsWith('meldung'))).toBe(true));
    expect(ablauf.schritte.some(s => s.startsWith('eingespielt'))).toBe(false);
    expect(ablauf.schritte.at(-1)).toMatch(/Es wurde nichts ersetzt/);
  });

  it('Zusammenführen braucht weder Rückfrage noch Kopie', async () => {
    ansicht();
    waehleDatei();
    fireEvent.click(screen.getByRole('button', { name: /Zusammenführen/ }));
    await vi.waitFor(() => expect(ablauf.schritte).toContain('eingespielt: merge'));
    expect(ablauf.schritte.some(s => s.startsWith('frage'))).toBe(false);
    expect(ablauf.schritte).not.toContain('kopie');
  });
});
