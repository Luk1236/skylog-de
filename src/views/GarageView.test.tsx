// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GarageView } from './GarageView';
import { WartungsDialog } from './flotte/WartungsDialog';
import type { Drone, MaintenanceRecord } from '../services/db';

const db = vi.hoisted(() => ({
  eintraege: [] as MaintenanceRecord[],
  getFlights: vi.fn(async () => []),
  getMaintenance: vi.fn(async () => db.eintraege),
  saveMaintenance: vi.fn(async (m: MaintenanceRecord) => { db.eintraege = [...db.eintraege, m]; }),
  deleteMaintenance: vi.fn(async (id: string) => { db.eintraege = db.eintraege.filter(m => m.id !== id); }),
  saveDrone: vi.fn(async () => {}),
  deleteDrone: vi.fn(async () => {}),
  saveBattery: vi.fn(async () => {}),
  deleteBattery: vi.fn(async () => {}),
}));
vi.mock('../services/db', () => ({ dbService: db }));

// Ganze Ansichten in jsdom brauchen unter Last mehr als die Standard-5-s.
vi.setConfig({ testTimeout: 20_000 });

const drohne = { id: 'd1', model: 'DJI Mini 4 Pro', weight: 249, uasClass: 'C0', createdAt: 1 } as Drone;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  db.eintraege = [];
});

describe('Flotte: Drohne registrieren', () => {
  it('speichert eine neue Drohne mit den Formularwerten', async () => {
    const onUpdate = vi.fn();
    render(<GarageView drones={[]} flights={[]} batteries={[]} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Drohne hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Modell / Name'), { target: { value: 'DJI Air 3' } });
    fireEvent.change(screen.getByLabelText('Gewicht (g)'), { target: { value: '720' } });
    fireEvent.change(screen.getByLabelText('C-Klasse'), { target: { value: 'C1' } });
    fireEvent.change(screen.getByLabelText('Max. Windgrenze (km/h)'), { target: { value: '38' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drohne registrieren' }));

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(db.saveDrone).toHaveBeenCalledWith(expect.objectContaining({
      model: 'DJI Air 3', weight: 720, uasClass: 'C1', maxWindSpeed: 38,
    }));
  });

  it('speichert nichts ohne Modellnamen', () => {
    render(<GarageView drones={[]} flights={[]} batteries={[]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Drohne hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Drohne registrieren' }));
    expect(db.saveDrone).not.toHaveBeenCalled();
  });
});

describe('Wartungsdialog', () => {
  it('trägt eine Wartung mit Typ, Kosten und Flugstunden ein', async () => {
    const onGeaendert = vi.fn();
    const stats = { hours: 12.5, flights: 30, lastMaint: {}, lastMaintHours: {}, flightsSinceMaint: {} };
    render(<WartungsDialog drohne={drohne} stats={stats} hinweise={[]} onClose={vi.fn()} onGeaendert={onGeaendert} />);

    fireEvent.click(screen.getByRole('button', { name: 'Neu' }));
    fireEvent.change(screen.getByLabelText('Typ'), { target: { value: 'Propeller' } });
    fireEvent.change(screen.getByLabelText('Kosten (€, optional)'), { target: { value: '24.9' } });
    fireEvent.change(screen.getByLabelText('Beschreibung'), { target: { value: 'Propeller-Satz getauscht' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));

    await vi.waitFor(() => expect(onGeaendert).toHaveBeenCalled());
    expect(db.saveMaintenance).toHaveBeenCalledWith(expect.objectContaining({
      droneId: 'd1', type: 'Propeller', cost: 24.9, description: 'Propeller-Satz getauscht', hoursAtMaintenance: 12.5,
    }));
    expect(await screen.findByText('Propeller-Satz getauscht')).toBeTruthy();
  });

  it('löscht einen Eintrag und bietet Rückgängig an', async () => {
    db.eintraege = [{ id: 'm1', droneId: 'd1', date: '2026-10-01', type: 'Motor', description: 'Motoren gereinigt', createdAt: 5 } as MaintenanceRecord];
    const onGeaendert = vi.fn();
    render(<WartungsDialog drohne={drohne} stats={undefined} hinweise={[]} onClose={vi.fn()} onGeaendert={onGeaendert} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Eintrag löschen' }));
    await vi.waitFor(() => expect(db.deleteMaintenance).toHaveBeenCalledWith('m1'));
    await vi.waitFor(() => expect(screen.queryByText('Motoren gereinigt')).toBeNull());
    expect(onGeaendert).toHaveBeenCalled();
  });
});
