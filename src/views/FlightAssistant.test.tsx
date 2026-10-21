// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FlightAssistant } from './FlightAssistant';
import { DEFAULT_PREFLIGHT } from '../services/checklists';
import type { Drone, Flight } from '../services/db';

// Keine Netzabrufe im Test: Wetter, Ortsname, Piloten und die beiden Panels
// mit eigenen Abrufen werden ersetzt.
vi.mock('../services/db', () => ({ dbService: { getPilots: vi.fn(async () => []) } }));
vi.mock('../services/weather', async orig => ({
  ...(await orig<typeof import('../services/weather')>()),
  fetchWeather: vi.fn(async () => null),
  fetchForecast: vi.fn(async () => []),
}));
vi.mock('../services/geocode', () => ({ ortsnameFuer: vi.fn(async () => null) }));
vi.mock('../components/AirspaceCheckPanel', () => ({ AirspaceCheckPanel: () => null }));
vi.mock('../components/AviationWeatherPanel', () => ({ AviationWeatherPanel: () => null }));
const dialog = vi.hoisted(() => ({ antwort: false }));
vi.mock('../services/dialog', () => ({ bestaetige: vi.fn(async () => dialog.antwort) }));

// Ganze Ansichten in jsdom durchzuklicken dauert unter Last (voller, paralleler
// Lauf) länger als die Standard-5-s - ohne Logikfehler. Großzügige Grenze.
vi.setConfig({ testTimeout: 20_000 });

const drohne = { id: 'd1', name: 'Mini', model: 'DJI Mini 4 Pro', weight: 249, uasClass: 'C0' } as Drone;
const T0 = 1_800_000_000_000;

function oeffne(onSave = vi.fn(), onClose = vi.fn()) {
  render(
    <FlightAssistant
      drones={[drohne]}
      batteries={[]}
      profile={null}
      letzterFlug={{ droneId: 'd1', purpose: 'Inspektion' } as Flight}
      onClose={onClose}
      onSave={onSave}
      currentLocation={[49.87, 8.65]}
    />,
  );
  return { onSave, onClose };
}

const klick = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

/** Vorbereitung → Checkliste komplett abhaken → Flug-Schritt. */
function bisZumFlug() {
  klick('Weiter zur Checkliste');
  for (const punkt of DEFAULT_PREFLIGHT) fireEvent.click(screen.getByRole('checkbox', { name: punkt }));
  klick(/Startklar/);
}

beforeEach(() => {
  localStorage.clear();
  dialog.antwort = false;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Flug-Assistent: Flug speichern', () => {
  it('speichert Drohne, Zweck, Abschnitte, Akku und Vorkommnisse', () => {
    const { onSave } = oeffne();
    bisZumFlug();
    const jetzt = vi.spyOn(Date, 'now').mockReturnValue(T0);
    klick('Flugabschnitt starten');
    jetzt.mockReturnValue(T0 + 125_000);
    klick('Flugabschnitt beenden');
    klick('Flug abschließen');

    fireEvent.change(screen.getByLabelText('Akku am Ende (%)'), { target: { value: '35' } });
    fireEvent.change(screen.getByLabelText('Vorkommnisse / Anomalien'), { target: { value: 'Greifvogel gesichtet' } });
    klick('Flug im Logbuch speichern');

    expect(onSave).toHaveBeenCalledTimes(1);
    const flug: Flight = onSave.mock.calls[0][0];
    expect(flug).toMatchObject({
      droneId: 'd1',
      purpose: 'Inspektion',
      pilotId: 'main',
      isGuest: false,
      duration: 2,
      coordinates: [49.87, 8.65],
      batteryStatus: { startPercent: 100, endPercent: 35 },
      incidents: 'Greifvogel gesichtet',
    });
    expect(flug.legs).toEqual([{ startTime: T0, endTime: T0 + 125_000, duration: 125 }]);
  });

  it('nimmt einen noch laufenden Abschnitt beim Abschließen mit (früher fehlte er)', () => {
    const { onSave } = oeffne();
    bisZumFlug();
    const jetzt = vi.spyOn(Date, 'now').mockReturnValue(T0);
    klick('Flugabschnitt starten');
    jetzt.mockReturnValue(T0 + 30_000);
    klick('Flug abschließen');
    klick('Flug im Logbuch speichern');

    const flug: Flight = onSave.mock.calls[0][0];
    expect(flug.legs).toEqual([{ startTime: T0, endTime: T0 + 30_000, duration: 30 }]);
    expect(flug.duration).toBe(1);
  });
});

describe('Flug-Assistent: Startfreigabe', () => {
  it('gibt den Start erst frei, wenn alle Vorflug-Punkte abgehakt sind', () => {
    oeffne();
    klick('Weiter zur Checkliste');
    const starten = screen.getByRole<HTMLButtonElement>('button', { name: /Startklar/ });
    for (const punkt of DEFAULT_PREFLIGHT.slice(1)) fireEvent.click(screen.getByRole('checkbox', { name: punkt }));
    expect(starten.disabled).toBe(true);
    expect(screen.getByText('Noch 1 Punkt abhaken')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: DEFAULT_PREFLIGHT[0] }));
    expect(starten.disabled).toBe(false);
  });

  it('sperrt den Start nicht, wenn die eigene Liste leer ist', () => {
    localStorage.setItem('skylog_checklist_preflight', '[]');
    oeffne();
    klick('Weiter zur Checkliste');
    expect(screen.getByText(/Die Liste ist leer/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Startklar/ }).disabled).toBe(false);
  });
});

describe('Flug-Assistent: Schließen', () => {
  it('fragt nach, bevor ein aufgezeichneter Flug verworfen wird', async () => {
    const { onClose } = oeffne();
    bisZumFlug();
    klick('Flugabschnitt starten');

    klick('Assistent schließen');
    await Promise.resolve();
    expect(onClose).not.toHaveBeenCalled();

    dialog.antwort = true;
    klick('Assistent schließen');
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('schließt ohne Rückfrage, solange nichts aufgezeichnet ist', async () => {
    const { onClose } = oeffne();
    klick('Assistent schließen');
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
