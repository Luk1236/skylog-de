// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Dialog } from './ui';
import { DialogHost } from './DialogHost';
import { bestaetige, melde } from '../services/dialog';

vi.setConfig({ testTimeout: 20_000 });
afterEach(() => cleanup());

function MitDialog() {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button onClick={() => setOffen(true)}>Öffnen</button>
      <button>Dahinter</button>
      {offen && (
        <Dialog titel="Wartung" onClose={() => setOffen(false)} fuss={<button>Speichern</button>}>
          <input aria-label="Notiz" />
        </Dialog>
      )}
    </>
  );
}

describe('Dialog: Fokusführung', () => {
  it('setzt den Fokus beim Öffnen in den Dialog und gibt ihn beim Schließen zurück', () => {
    render(<MitDialog />);
    const ausloeser = screen.getByRole('button', { name: 'Öffnen' });
    ausloeser.focus();
    fireEvent.click(ausloeser);
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Wartung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(document.activeElement).toBe(ausloeser);
  });

  it('hält Tab und Umschalt+Tab im Dialog', () => {
    render(<MitDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
    const dialog = screen.getByRole('dialog', { name: 'Wartung' });
    const schliessen = screen.getByRole('button', { name: 'Schließen' });
    const speichern = screen.getByRole('button', { name: 'Speichern' });
    speichern.focus();
    fireEvent.keyDown(speichern, { key: 'Tab' });
    expect(document.activeElement).toBe(schliessen);
    fireEvent.keyDown(schliessen, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(speichern);
    // Vom Startfokus (der Dialog selbst) rückwärts: ans Ende statt auf die Seite
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(speichern);
  });
});

describe('Rückfrage', () => {
  it('hat einen Namen, setzt den Fokus auf Abbrechen und gibt ihn zurück', async () => {
    render(<><button>Eintrag löschen</button><DialogHost /></>);
    const ausloeser = screen.getByRole('button', { name: 'Eintrag löschen' });
    ausloeser.focus();
    let antwort: Promise<boolean> = Promise.resolve(true);
    act(() => { antwort = bestaetige('Diesen Eintrag wirklich löschen?', { titel: 'Löschen?', gefaehrlich: true }); });
    const dialog = await screen.findByRole('alertdialog', { name: 'Löschen?' });
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await expect(antwort).resolves.toBe(false);
    expect(document.activeElement).toBe(ausloeser);
  });

  it('nimmt ohne Titel den Text als Namen und fokussiert OK', async () => {
    render(<DialogHost />);
    let fertig: Promise<boolean> = Promise.resolve(true);
    act(() => { fertig = melde('Sicherung gespeichert.'); });
    expect(await screen.findByRole('alertdialog', { name: 'Sicherung gespeichert.' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'OK' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await fertig;
  });
});
