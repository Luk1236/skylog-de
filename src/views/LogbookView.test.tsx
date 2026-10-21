// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LogbookView } from './LogbookView';
import type { Drone, Flight } from '../services/db';

const db = vi.hoisted(() => ({
  saveFlight: vi.fn(async () => {}),
  deleteFlight: vi.fn(async () => {}),
  restoreFlight: vi.fn(async () => {}),
  getPilots: vi.fn(async () => []),
}));
vi.mock('../services/db', () => ({ dbService: db }));
const dialog = vi.hoisted(() => ({ melde: vi.fn() }));
vi.mock('../services/dialog', () => ({ melde: dialog.melde, bestaetige: vi.fn(async () => true) }));
// Diagramme brauchen echte Maße - im Test nur Platzhalter.
vi.mock('./logbuch/LogbuchKennzahlen', () => ({ LogbuchKennzahlen: () => null }));

// Ganze Ansichten in jsdom durchzuklicken dauert unter Last (voller, paralleler
// Lauf) länger als die Standard-5-s - ohne Logikfehler. Großzügige Grenze.
vi.setConfig({ testTimeout: 20_000 });

const drohne = { id: 'd1', name: 'Mini', model: 'DJI Mini 4 Pro', weight: 249, uasClass: 'C0' } as Drone;

function oeffne(flights: Flight[] = []) {
  const onUpdate = vi.fn();
  render(
    <LogbookView flights={flights} drones={[drohne]} batteries={[]} profile={null} onUpdate={onUpdate} currentLocation={[49.87, 8.65]} />,
  );
  return { onUpdate };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Logbuch: Flug von Hand speichern', () => {
  it('speichert den Flug mit Vorbelegung und Eingaben', async () => {
    const { onUpdate } = oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Flug' }));
    fireEvent.change(screen.getByLabelText('Dauer (Minuten)'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Einsatzort'), { target: { value: 'Griesheim' } });
    fireEvent.change(screen.getByLabelText('Zweck'), { target: { value: 'Training' } });
    fireEvent.click(screen.getByRole('button', { name: 'Flug speichern' }));

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(db.saveFlight).toHaveBeenCalledTimes(1);
    const flug = (db.saveFlight.mock.calls[0] as unknown as [Flight])[0];
    expect(flug).toMatchObject({
      droneId: 'd1',
      date: new Date().toISOString().split('T')[0],
      duration: 25,
      locationName: 'Griesheim',
      purpose: 'Training',
      coordinates: [49.87, 8.65],
    });
    // Formular schließt nach dem Speichern
    expect(screen.queryByRole('button', { name: 'Flug speichern' })).toBeNull();
  });

  it('weist eine fehlende Flugdauer freundlich ab', () => {
    oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Flug' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flug speichern' }));
    expect(dialog.melde).toHaveBeenCalledWith('Bitte eine Flugdauer von mindestens 1 Minute eingeben.');
    expect(db.saveFlight).not.toHaveBeenCalled();
  });

  it('übernimmt Drohne und Zweck vom letzten Flug', () => {
    oeffne([{ id: 'f0', droneId: 'd1', date: '2026-01-02', duration: 10, purpose: 'Inspektion', locationName: 'Alt', coordinates: [0, 0], location: '', notes: '', createdAt: 1 } as Flight]);
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Flug' }));
    expect(screen.getByLabelText<HTMLSelectElement>('Drohne').value).toBe('d1');
    expect(screen.getByLabelText<HTMLSelectElement>('Zweck').value).toBe('Inspektion');
  });
});
