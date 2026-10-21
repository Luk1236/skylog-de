// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SafetyView } from './SafetyView';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ansicht = (props: Partial<Parameters<typeof SafetyView>[0]> = {}) =>
  render(<SafetyView profile={null} drones={[]} onBehoerdenCheck={vi.fn()} {...props} />);

describe('Sicherheit: Notfall-Koordinaten', () => {
  it('zeigt bei bekanntem Standort die Koordinaten und kopiert sie', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    ansicht({ standort: [49.872831, 8.651177] });
    expect(screen.getByText('49.87283, 8.65118')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Koordinaten kopieren' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('49.87283, 8.65118'));
  });

  it('erfindet ohne Standort keine Koordinaten und bietet das Orten an', () => {
    const onStandortFreigeben = vi.fn();
    ansicht({ onStandortFreigeben });
    expect(screen.getByText(/Standort nicht bekannt/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Koordinaten kopieren' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Orten' }));
    expect(onStandortFreigeben).toHaveBeenCalled();
  });

  it('sagt während der Suche, dass der Standort ermittelt wird', () => {
    ansicht({ ortet: true });
    expect(screen.getByText(/Standort wird ermittelt/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Orten' })).toBeNull();
  });

  it('bietet den Notruf als Telefon-Link an', () => {
    ansicht();
    expect(screen.getByRole('link', { name: /112 anrufen/ }).getAttribute('href')).toBe('tel:112');
  });
});
