// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StandortHinweis } from './StandortHinweis';
import { ChecklistEditorDialog } from './ChecklistEditorDialog';
import { DEFAULT_POSTFLIGHT, ladeChecklist } from '../services/checklists';

const dialog = vi.hoisted(() => ({ antwort: true }));
vi.mock('../services/dialog', () => ({ bestaetige: vi.fn(async () => dialog.antwort), melde: vi.fn() }));

vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('StandortHinweis', () => {
  it('erklärt den Zweck und meldet die drei Wahlmöglichkeiten', () => {
    const onFreigeben = vi.fn();
    const onVonHand = vi.fn();
    const onSchliessen = vi.fn();
    render(<StandortHinweis onFreigeben={onFreigeben} onVonHand={onVonHand} onSchliessen={onSchliessen} />);
    expect(screen.getByText(/Flugzonen, Wetter und Notfall-Koordinaten/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Von Hand' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nicht mehr fragen' }));
    expect(onFreigeben).toHaveBeenCalledTimes(1);
    expect(onVonHand).toHaveBeenCalledTimes(1);
    expect(onSchliessen).toHaveBeenCalledTimes(1);
  });
});

describe('ChecklistEditorDialog', () => {
  const oeffne = () => render(<ChecklistEditorDialog art="postflight" titel="Nachflug-Checkliste" onClose={vi.fn()} />);

  it('fügt Punkte hinzu und speichert sofort', () => {
    oeffne();
    fireEvent.change(screen.getByPlaceholderText('Neuer Prüfpunkt…'), { target: { value: 'Rotorblätter abgewischt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(ladeChecklist('postflight').map(p => p.text)).toEqual([...DEFAULT_POSTFLIGHT, 'Rotorblätter abgewischt']);
  });

  it('löscht und verschiebt Punkte', () => {
    oeffne();
    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]);
    expect(ladeChecklist('postflight').map(p => p.text)).toEqual(DEFAULT_POSTFLIGHT.slice(1));
    fireEvent.click(screen.getAllByRole('button', { name: 'Nach unten' })[0]);
    expect(ladeChecklist('postflight').map(p => p.text).slice(0, 2)).toEqual([DEFAULT_POSTFLIGHT[2], DEFAULT_POSTFLIGHT[1]]);
  });

  it('setzt nach Rückfrage auf die Standardpunkte zurück', async () => {
    localStorage.setItem('skylog_checklist_postflight', JSON.stringify([{ id: 'x', text: 'Nur ein Punkt' }]));
    oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Auf Standard zurücksetzen' }));
    await vi.waitFor(() => expect(ladeChecklist('postflight').map(p => p.text)).toEqual(DEFAULT_POSTFLIGHT));
  });
});
