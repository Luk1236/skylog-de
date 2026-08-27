// @vitest-environment jsdom
//
// Smoke-Tests: Jede Haupt-Ansicht muss ohne Absturz rendern. Genau diese
// Prüfung hätte den Profil-Crash (nicht importiertes <Lock/> → window.Lock →
// "Illegal constructor") gefangen — die Service-Unit-Tests konnten das nicht.
//
// Bewusst dünn: kein Klick-Durchlauf, nur "rendert überhaupt". Karten (Leaflet),
// Diagramme (recharts) und die Datenbank werden gestubbt, damit die Ansichten
// in jsdom isoliert rendern.

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// --- Mocks für Dinge, die in jsdom nicht laufen -----------------------------
// Factories sind hochgezogen → keine Referenzen auf Top-Level-Variablen.

vi.mock('recharts', () => {
  const S = (p: { children?: unknown }) => (p.children ?? null) as any;
  return {
    ResponsiveContainer: S, LineChart: S, Line: S, BarChart: S, Bar: S,
    AreaChart: S, Area: S, PieChart: S, Pie: S, Cell: S,
    XAxis: S, YAxis: S, Tooltip: S, CartesianGrid: S, Legend: S,
  };
});
vi.mock('react-leaflet', () => {
  const S = (p: { children?: unknown }) => (p.children ?? null) as any;
  return {
    MapContainer: S, TileLayer: S, WMSTileLayer: S, Marker: S, Popup: S,
    Polyline: S, Polygon: S, Rectangle: S, Circle: S, GeoJSON: S,
    useMap: () => ({}), useMapEvents: () => ({}),
  };
});

// Datenbank: alle Methoden liefern harmlos leere Daten (Ansichten laden im
// useEffect Daten nach — der Render selbst darf davon nicht abhängen).
vi.mock('./services/db', async (orig) => {
  const actual = await orig<typeof import('./services/db')>();
  return {
    ...actual,
    dbService: new Proxy({}, { get: () => async () => [] }),
  };
});

import { SprachProvider } from './lib/sprache';
import {
  LogbookView,
} from './App';
import { RoadmapView } from './views/RoadmapView';
import { SafetyView } from './views/SafetyView';
import { ProfileView } from './views/ProfileView';
import { GarageView } from './views/GarageView';
import { KnowledgeView, InventoryView, PilotsView } from './views/InfoViews';

const wrap = (ui: React.ReactElement) => render(<SprachProvider sprache="de">{ui}</SprachProvider>);
const noop = () => {};
const ort: [number, number] = [52.52, 13.4];

describe('View-Smoke-Tests (rendern ohne Absturz)', () => {
  it('ProfileView', () => {
    const { container } = wrap(<ProfileView profile={null} documents={[]} onUpdate={noop} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('GarageView', () => {
    const { container } = wrap(<GarageView drones={[]} flights={[]} batteries={[]} onUpdate={noop} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('SafetyView', () => {
    const { container } = wrap(<SafetyView profile={null} drones={[]} onBehoerdenCheck={noop} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('RoadmapView', () => {
    const { container } = wrap(<RoadmapView />);
    expect(container.firstChild).toBeTruthy();
  });

  it('LogbookView', () => {
    const { container } = wrap(
      <LogbookView flights={[]} drones={[]} batteries={[]} profile={null} onUpdate={noop} currentLocation={ort} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('KnowledgeView', () => {
    const { container } = wrap(<KnowledgeView />);
    expect(container.firstChild).toBeTruthy();
  });

  it('InventoryView', () => {
    const { container } = wrap(<InventoryView />);
    expect(container.firstChild).toBeTruthy();
  });

  it('PilotsView', () => {
    const { container } = wrap(<PilotsView />);
    expect(container.firstChild).toBeTruthy();
  });
});
