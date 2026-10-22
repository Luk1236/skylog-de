// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Map as KartenIcon, Settings } from 'lucide-react';
import { PinLockDialog } from './PinLockDialog';
import { BehoerdenCheckDialog } from './BehoerdenCheckDialog';
import { RiskAssessmentDialog } from './RiskAssessmentDialog';
import { MehrSheet } from './AppNavigation';
import type { Drone, UserProfile } from '../services/db';

const pin = vi.hoisted(() => ({
  setPin: vi.fn(async (_p: string) => {}),
  verifyPin: vi.fn(async (p: string) => (p === '2468' ? { ok: true, gesperrtSekunden: 0 } : { ok: false, gesperrtSekunden: 0 })),
}));
vi.mock('../services/pinProtection', () => ({
  setPin: pin.setPin, verifyPin: pin.verifyPin, removePin: vi.fn(), isPinEnabled: () => false, sperreRestSekunden: () => 0,
}));

vi.setConfig({ testTimeout: 20_000 });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

const tippe = (ziffern: string) => { for (const z of ziffern) fireEvent.click(screen.getByRole('button', { name: z })); };

describe('PIN-Sperre', () => {
  it('richtet einen PIN mit Bestätigung ein', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<PinLockDialog mode="setup" onClose={onClose} />);
    tippe('1357');
    expect(screen.getByText('PIN zur Bestätigung wiederholen')).toBeTruthy();
    tippe('1357');
    await act(async () => { await Promise.resolve(); });
    expect(pin.setPin).toHaveBeenCalledWith('1357');
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(onClose).toHaveBeenCalled();
  });

  it('verwirft eine abweichende Bestätigung', () => {
    render(<PinLockDialog mode="setup" />);
    tippe('1357');
    tippe('2468');
    expect(screen.getByText(/PINs stimmen nicht überein/)).toBeTruthy();
    expect(pin.setPin).not.toHaveBeenCalled();
    expect(screen.getByText('Gib 4 Ziffern ein')).toBeTruthy();
  });

  it('entsperrt nur mit dem richtigen PIN', async () => {
    const onUnlocked = vi.fn();
    render(<PinLockDialog mode="unlock" onUnlocked={onUnlocked} />);
    tippe('1111');
    expect(await screen.findByText('Falscher PIN. Bitte erneut versuchen.')).toBeTruthy();
    expect(onUnlocked).not.toHaveBeenCalled();
    tippe('2468');
    await vi.waitFor(() => expect(onUnlocked).toHaveBeenCalled());
  });

  it('beschriftet die Sondertasten und sagt den Fortschritt an', () => {
    render(<PinLockDialog mode="unlock" />);
    expect(screen.getByRole('button', { name: 'Eingabe löschen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Letzte Ziffer löschen' })).toBeTruthy();
    tippe('12');
    expect(screen.getByText('2 von 4 Ziffern eingegeben')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Letzte Ziffer löschen' }));
    expect(screen.getByText('1 von 4 Ziffern eingegeben')).toBeTruthy();
  });
});

describe('Behörden-Check', () => {
  it('zeigt Betreiberdaten und Drohne als Vollbild-Dialog', () => {
    const profil = { id: 'main_profile', name: 'Anna Beispiel', eid: 'DEU87astrdge12k8' } as UserProfile;
    const drohne = { id: 'd1', model: 'DJI Mini 4 Pro', weight: 249, uasClass: 'C0', createdAt: 1 } as Drone;
    render(<BehoerdenCheckDialog profile={profil} drohnen={[drohne]} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Behörden-Check' })).toBeTruthy();
    expect(screen.getAllByText(/DEU87astrdge12k8/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/DJI Mini 4 Pro/).length).toBeGreaterThan(0);
  });

  it('warnt, wenn Angaben für die Kontrolle fehlen', () => {
    render(<BehoerdenCheckDialog profile={null} drohnen={[]} onClose={vi.fn()} />);
    expect(screen.getByText('Vor der Kontrolle prüfen')).toBeTruthy();
  });
});

describe('Risiko-Einordnung', () => {
  it('ordnet nach Klasse ein: C0 in A1, schwere Drohne in A3 mit Verstoß, über 120 m Specific', () => {
    const mini = { id: 'd1', model: 'DJI Mini 4 Pro', weight: 249, uasClass: 'C0', createdAt: 1 } as Drone;
    const schwer = { id: 'd2', model: 'Schwerlast', weight: 4000, uasClass: 'Legacy', createdAt: 1 } as Drone;
    render(<RiskAssessmentDialog drohnen={[mini, schwer]} onClose={vi.fn()} />);
    expect(screen.getByText('Open A1')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Drohne'), { target: { value: 'd2' } });
    fireEvent.change(screen.getByLabelText('Umgebung / Unbeteiligte'), { target: { value: 'ueber_unbeteiligten' } });
    expect(screen.getByText('Open A3')).toBeTruthy();
    expect(screen.getByText(/In A3 dürfen keine Unbeteiligten im Bereich sein/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Flughöhe (m)'), { target: { value: '150' } });
    expect(screen.getByText('Specific')).toBeTruthy();
    expect(screen.getByText(/Außerhalb der Open-Kategorie/)).toBeTruthy();
  });
});

describe('Mehr-Menü', () => {
  it('listet die Einträge in Gruppen und meldet die Auswahl', () => {
    const onWaehle = vi.fn();
    const eintrag = { id: 'karte', icon: KartenIcon, label: 'Karte', view: 'map' as const };
    render(<MehrSheet gruppen={[{ titel: 'Werkzeuge', eintraege: [eintrag, { id: 'einst', icon: Settings, label: 'Einstellungen' }] }]}
      activeView={'map' as never} onWaehle={onWaehle} onClose={vi.fn()} theme="light" sprache="de" onTheme={vi.fn()} onSprache={vi.fn()} />);
    expect(screen.getByText('Werkzeuge')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Einstellungen/ }));
    expect(onWaehle).toHaveBeenCalledWith(expect.objectContaining({ id: 'einst' }));
  });
});
