// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SoraWizardDialog } from './SoraWizardDialog';
import { CustomerManagerDialog } from './CustomerManagerDialog';
import type { Customer, Drone } from '../services/db';

vi.setConfig({ testTimeout: 20_000 });
afterEach(() => cleanup());

const air3 = { id: 'd1', model: 'DJI Air 3', weight: 720, uasClass: 'C1', createdAt: 1 } as Drone;

describe('SORA-Assistent', () => {
  const igrc = () => screen.getByText(/Boden-Risikowert \(iGRC\)/).closest('p')?.textContent ?? '';

  it('berechnet den Boden-Risikowert aus der SORA-2.5-Tabelle und sperrt M1(A) über Menschenansammlungen', () => {
    render(<SoraWizardDialog drones={[air3]} profile={null} onClose={vi.fn()} />);
    // 1 m Abmessung, 25 m/s, unter 500 Pers./km² -> Table 1 ergibt 4
    expect(igrc()).toMatch(/4$/);
    const m1a = screen.getByLabelText(/M1\(A\)/) as HTMLSelectElement;
    expect(m1a.disabled).toBe(false);

    fireEvent.change(screen.getByLabelText(/Bevölkerungsdichte/), { target: { value: 'ueber50000' } });
    expect(igrc()).toMatch(/7$/);
    expect(m1a.disabled).toBe(true);
    expect(screen.getByText('Nicht über Menschenansammlungen anrechenbar.')).toBeTruthy();
  });

  it('zeigt nach der Bewertung SAIL und PDF-Export und kehrt zu den Parametern zurück', () => {
    render(<SoraWizardDialog drones={[air3]} profile={null} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /SORA-2.5-Risikobewertung ausführen/ }));
    expect(screen.getByText('Ergebnis SAIL')).toBeTruthy();
    expect(screen.getByRole('button', { name: /SORA-Dossier als PDF exportieren/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Parameter ändern' }));
    expect(screen.getByLabelText(/Bevölkerungsdichte/)).toBeTruthy();
  });
});

describe('Kundenverwaltung', () => {
  const dialog = (customers: Customer[] = []) => {
    const onSaveCustomer = vi.fn(async () => {});
    const onDeleteCustomer = vi.fn(async () => {});
    render(<CustomerManagerDialog customers={customers} flights={[]} drones={[]} profile={null}
      onSaveCustomer={onSaveCustomer} onDeleteCustomer={onDeleteCustomer} onClose={vi.fn()} />);
    return { onSaveCustomer, onDeleteCustomer };
  };

  it('legt einen Kunden mit bereinigten Angaben an', async () => {
    const { onSaveCustomer } = dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Kunden anlegen' }));
    fireEvent.change(screen.getByPlaceholderText('Kundenname / Ansprechpartner *'), { target: { value: '  Anna Beispiel ' } });
    fireEvent.change(screen.getByPlaceholderText('Firmenname (optional)'), { target: { value: 'Beispiel GmbH' } });
    fireEvent.change(screen.getByPlaceholderText('E-Mail-Adresse'), { target: { value: 'anna@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kunde speichern' }));
    await vi.waitFor(() => expect(onSaveCustomer).toHaveBeenCalledTimes(1));
    expect(onSaveCustomer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Anna Beispiel', company: 'Beispiel GmbH', email: 'anna@example.com' }));
  });

  it('speichert ohne Namen nichts', async () => {
    const { onSaveCustomer } = dialog();
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Kunden anlegen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kunde speichern' }));
    await new Promise(r => setTimeout(r, 50));
    expect(onSaveCustomer).not.toHaveBeenCalled();
  });

  it('löscht einen vorhandenen Kunden', () => {
    const { onDeleteCustomer } = dialog([{ id: 'k1', name: 'Bernd Kunde', createdAt: 1 } as Customer]);
    expect(screen.getByText('Bernd Kunde')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kunde löschen' }));
    expect(onDeleteCustomer).toHaveBeenCalledWith('k1');
  });
});
