// Lazy geladene Ansichten.
//
// Der erste Bildschirm ist die Karte. Alle anderen Ansichten (Logbuch, Flotte,
// Profil …) werden erst beim ersten Öffnen nachgeladen. Vorher zog allein die
// fest eingebundene Logbuch-Ansicht die Diagramm-Bibliothek (recharts, ~375 kB)
// in den Erststart, obwohl sie dort niemand sieht.
//
// Gleiches Muster wie lazyDialogs.tsx: dünner Wrapper mit eigener Suspense-
// Grenze, gleiche Props wie das Original - App.tsx bleibt unverändert lesbar.

import { lazy, Suspense, type ComponentProps, type ComponentType, type JSX } from 'react';

function Ladeanzeige() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Wird geladen">
      <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-brand-blue animate-spin" />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Props-Typ wird ueber ComponentProps<C> wiederhergestellt
function lazyAnsicht<C extends (props: any) => JSX.Element | null>(
  loader: () => Promise<{ default: C }>,
): ComponentType<ComponentProps<C>> {
  const Geladen = lazy(loader);
  return (props: ComponentProps<C>) => (
    <Suspense fallback={<Ladeanzeige />}>
      <Geladen {...props} />
    </Suspense>
  );
}

export const LogbookView = lazyAnsicht(() => import('./LogbookView').then(m => ({ default: m.LogbookView })));
export const GarageView = lazyAnsicht(() => import('./GarageView').then(m => ({ default: m.GarageView })));
export const ProfileView = lazyAnsicht(() => import('./ProfileView').then(m => ({ default: m.ProfileView })));
export const SafetyView = lazyAnsicht(() => import('./SafetyView').then(m => ({ default: m.SafetyView })));
export const RoadmapView = lazyAnsicht(() => import('./RoadmapView').then(m => ({ default: m.RoadmapView })));
export const KnowledgeView = lazyAnsicht(() => import('./InfoViews').then(m => ({ default: m.KnowledgeView })));
export const InventoryView = lazyAnsicht(() => import('./InfoViews').then(m => ({ default: m.InventoryView })));
export const PilotsView = lazyAnsicht(() => import('./InfoViews').then(m => ({ default: m.PilotsView })));
