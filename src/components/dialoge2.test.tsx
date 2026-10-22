// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SprachProvider } from '../lib/sprache';
import { StatisticsDialog } from './StatisticsDialog';
import { FlightImportDialog } from './FlightImportDialog';
import { ManualLocationDialog } from './ManualLocationDialog';
import { LocationFavoritesDialog } from './LocationFavoritesDialog';
import { DatensicherungDialog } from './DatensicherungDialog';
import type { Drone, Flight } from '../services/db';

// Diagramme brauchen in jsdom keine Zeichenfläche.
vi.mock('recharts', () => {
  const Huelle = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Nichts = () => null;
  return { ResponsiveContainer: Huelle, BarChart: Huelle, Bar: Nichts, XAxis: Nichts, YAxis: Nichts, Tooltip: Nichts };
});

const db = vi.hoisted(() => ({ gespeichert: [] as unknown[] }));
vi.mock('../services/db', async (original) => ({
  ...await original<typeof import('../services/db')>(),
  dbService: { saveFlight: vi.fn(async (f: unknown) => { db.gespeichert.push(f); }) },
}));

const sicherung = vi.hoisted(() => ({ export: vi.fn(async (_p?: string) => {}) }));
vi.mock('../services/backup', () => ({ exportBackup: sicherung.export, getLastBackupAt: () => null }));

vi.setConfig({ testTimeout: 20_000 });
afterEach(() => { cleanup(); db.gespeichert = []; vi.clearAllMocks(); });

const air3 = { id: 'd1', model: 'DJI Air 3', weight: 720, uasClass: 'C1', createdAt: 1 } as Drone;
const flug = (over: Partial<Flight>) => ({
  id: Math.random().toString(36).slice(2), droneId: 'd1', date: '2026-10-20', startTime: '10:00', endTime: '10:20',
  duration: 20, location: 'Feld', locationName: 'Feld', notes: '', createdAt: 1, ...over,
}) as Flight;

describe('Statistik', () => {
  it('beschriftet die Kennzahlen in der eingestellten Sprache', () => {
    const fluege = [flug({ duration: 30 }), flug({ duration: 10, date: '2026-10-21' })];
    const { unmount } = render(<SprachProvider sprache="en"><StatisticsDialog flights={fluege} drones={[air3]} onClose={vi.fn()} /></SprachProvider>);
    for (const text of ['Total flight time', 'Active days', 'Longest flight', 'Avg. flight time', 'Take-offs']) expect(screen.getByText(text)).toBeTruthy();
    unmount();
    render(<StatisticsDialog flights={fluege} drones={[air3]} onClose={vi.fn()} />);
    expect(screen.getByText('Flugzeit gesamt')).toBeTruthy();
    expect(screen.getByText('DJI Air 3')).toBeTruthy();
  });

  it('sagt ohne Flüge, dass noch nichts auszuwerten ist', () => {
    render(<StatisticsDialog flights={[]} drones={[]} onClose={vi.fn()} />);
    expect(screen.getByText(/Noch keine Flüge/)).toBeTruthy();
  });
});

describe('Flüge importieren', () => {
  const csv = [
    'Date,Duration (min),Latitude,Longitude,Location,Max Height (ft),Battery Start,Battery End',
    '2026-07-19 14:30,14,49.8728,8.6512,"Darmstadt, Hessen",328,98,42',
    '2026-07-20 09:15,22,49.8730,8.6520,Griesheim,164,100,55',
  ].join('\n');

  it('zeigt die erkannten Flüge und übernimmt sie ins Logbuch', async () => {
    const onImported = vi.fn();
    render(<FlightImportDialog drohnen={[air3]} vorhandeneFluege={[]} onClose={vi.fn()} onImported={onImported} />);
    const eingabe = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(eingabe, { target: { files: [new File([csv], 'airdata.csv', { type: 'text/csv' })] } });
    expect(await screen.findByText(/Darmstadt, Hessen/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /2 Flug\/Flüge übernehmen/ }));
    await vi.waitFor(() => expect(onImported).toHaveBeenCalledWith(2));
    expect(db.gespeichert).toHaveLength(2);
    expect(db.gespeichert[0]).toMatchObject({ date: '2026-07-19', duration: 14, droneId: 'd1' });
  });
});

describe('Standort von Hand', () => {
  it('übernimmt eingetippte Koordinaten', () => {
    const onPick = vi.fn();
    render(<ManualLocationDialog aktuell={[52.52, 13.405]} onPick={onPick} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('52.5200, 13.4050'), { target: { value: '49.8728, 8.6512' } });
    fireEvent.click(screen.getByRole('button', { name: 'Standort übernehmen' }));
    expect(onPick).toHaveBeenCalledWith(49.8728, 8.6512, '');
  });
});

describe('Lieblingsorte', () => {
  it('legt einen neuen Lieblingsort an', async () => {
    const onSaveFavorite = vi.fn(async () => {});
    render(<LocationFavoritesDialog favorites={[]} onSaveFavorite={onSaveFavorite} onDeleteFavorite={vi.fn(async () => {})} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Ort' }));
    fireEvent.change(screen.getByPlaceholderText('Titel des Ortes'), { target: { value: 'Herrngarten' } });
    fireEvent.change(screen.getByPlaceholderText('z.B. 49.8730'), { target: { value: '49.877' } });
    fireEvent.change(screen.getByPlaceholderText('z.B. 8.6520'), { target: { value: '8.653' } });
    fireEvent.click(screen.getByRole('button', { name: 'Favorit hinzufügen' }));
    await vi.waitFor(() => expect(onSaveFavorite).toHaveBeenCalledTimes(1));
    expect(onSaveFavorite).toHaveBeenCalledWith(expect.objectContaining({ name: 'Herrngarten' }));
  });
});

describe('Datensicherung', () => {
  it('exportiert ohne Passwort unverschlüsselt', async () => {
    render(<DatensicherungDialog onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Sicherung jetzt exportieren/ }));
    await vi.waitFor(() => expect(sicherung.export).toHaveBeenCalledWith(undefined));
    expect(await screen.findByText('Sicherung erstellt.')).toBeTruthy();
  });
});
