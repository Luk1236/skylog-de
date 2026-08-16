// Lazy geladene Dialoge.
//
// Diese modalen Dialoge werden nur beim Öffnen gebraucht. Statt sie ins
// Haupt-Bundle zu packen (und mit ihnen schwere Abhängigkeiten wie recharts,
// jspdf, html2canvas und qrcode), lädt jeder Dialog seinen Code erst beim
// ersten Anzeigen nach. Das verkleinert den Erststart spürbar.
//
// Jeder Export ist ein hauchdünner Wrapper: gleiche Props wie das Original,
// aber intern React.lazy + eine eigene Suspense-Grenze. Dadurch bleibt der
// Aufruf in App.tsx unverändert (`<StatisticsDialog … />`) und ein noch
// ladender Dialog blendet nur sich selbst kurz aus, nie die ganze App.
//
// Bewusst NICHT hier: PinLockDialog (App-Sperre, muss ohne Verzögerung
// erscheinen), DialogHost und die Karten-Layer/Panels (auf dem ersten
// Bildschirm sichtbar).

import { lazy, Suspense, type ComponentType } from 'react';

/** Aus einem benannten Export einen lazy geladenen, in Suspense gehüllten
 *  Dialog machen. Fallback ist bewusst null: der Dialog ist ein Overlay,
 *  ein kurzes Nichts ist unauffälliger als ein Platzhalter. */
function lazyDialog<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): ComponentType<P> {
  const Geladen = lazy(loader);
  return (props: P) => (
    <Suspense fallback={null}>
      <Geladen {...props} />
    </Suspense>
  );
}

export const BatteryDetailDialog = lazyDialog(() =>
  import('./BatteryDetailDialog').then(m => ({ default: m.BatteryDetailDialog })));
export const RiskAssessmentDialog = lazyDialog(() =>
  import('./RiskAssessmentDialog').then(m => ({ default: m.RiskAssessmentDialog })));
export const ChecklistEditorDialog = lazyDialog(() =>
  import('./ChecklistEditorDialog').then(m => ({ default: m.ChecklistEditorDialog })));
export const OfflineMapsDialog = lazyDialog(() =>
  import('./OfflineMapsDialog').then(m => ({ default: m.OfflineMapsDialog })));
export const EuZonesDialog = lazyDialog(() =>
  import('./EuZonesDialog').then(m => ({ default: m.EuZonesDialog })));
export const FlightPlannerDialog = lazyDialog(() =>
  import('./FlightPlannerDialog').then(m => ({ default: m.FlightPlannerDialog })));
export const FlightMediaDialog = lazyDialog(() =>
  import('./FlightMediaDialog').then(m => ({ default: m.FlightMediaDialog })));
export const FlightImportDialog = lazyDialog(() =>
  import('./FlightImportDialog').then(m => ({ default: m.FlightImportDialog })));
export const BehoerdenCheckDialog = lazyDialog(() =>
  import('./BehoerdenCheckDialog').then(m => ({ default: m.BehoerdenCheckDialog })));
export const IncidentReportDialog = lazyDialog(() =>
  import('./IncidentReportDialog').then(m => ({ default: m.IncidentReportDialog })));
export const FlightTrackDialog = lazyDialog(() =>
  import('./FlightTrackDialog').then(m => ({ default: m.FlightTrackDialog })));
export const StatisticsDialog = lazyDialog(() =>
  import('./StatisticsDialog').then(m => ({ default: m.StatisticsDialog })));
export const EidDialog = lazyDialog(() =>
  import('./EidDialog').then(m => ({ default: m.EidDialog })));
export const LocationFavoritesDialog = lazyDialog(() =>
  import('./LocationFavoritesDialog').then(m => ({ default: m.LocationFavoritesDialog })));
export const CustomerManagerDialog = lazyDialog(() =>
  import('./CustomerManagerDialog').then(m => ({ default: m.CustomerManagerDialog })));
export const SoraWizardDialog = lazyDialog(() =>
  import('./SoraWizardDialog').then(m => ({ default: m.SoraWizardDialog })));
export const CloudBackupDialog = lazyDialog(() =>
  import('./CloudBackupDialog').then(m => ({ default: m.CloudBackupDialog })));
export const StaffelMatrixDialog = lazyDialog(() =>
  import('./StaffelMatrixDialog').then(m => ({ default: m.StaffelMatrixDialog })));
export const PreFlightSafetyDialog = lazyDialog(() =>
  import('./PreFlightSafetyDialog').then(m => ({ default: m.PreFlightSafetyDialog })));
