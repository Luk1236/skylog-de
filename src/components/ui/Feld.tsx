import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Klassen für Eingabefelder, Selects und Textbereiche (siehe DESIGN.md). */
export const eingabe =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue';

/** Klassen für die Beschriftung über einem Feld. */
export const beschriftung = 'block text-xs font-bold text-slate-600 mb-1';

/** Beschriftetes Feld. `htmlFor` mit der `id` des Eingabefelds verbinden. */
export function Feld({ label, htmlFor, hinweis, fehler, className, children }: {
  label: ReactNode;
  htmlFor?: string;
  hinweis?: ReactNode;
  fehler?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className={beschriftung} htmlFor={htmlFor}>{label}</label>
      {children}
      {fehler
        ? <p className="text-xs font-bold text-brand-red mt-1">{fehler}</p>
        : hinweis && <p className="text-xs text-slate-500 mt-1">{hinweis}</p>}
    </div>
  );
}

/** Eyebrow-Überschrift über einer Gruppe, optional mit Aktion rechts. */
export function Abschnitt({ titel, aktion, className }: { titel: ReactNode; aktion?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-2', className)}>
      <h3 className="text-2xs font-bold uppercase tracking-wider text-slate-500">{titel}</h3>
      {aktion}
    </div>
  );
}

/** Kopf jeder Ansicht: Titel, Untertitel und rechts optional Aktionen. */
export function SeitenKopf({ titel, untertitel, aktionen }: { titel: ReactNode; untertitel?: ReactNode; aktionen?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">{titel}</h2>
        {untertitel && <p className="text-xs font-medium text-slate-500 mt-0.5">{untertitel}</p>}
      </div>
      {/* Auf schmalen Bildschirmen rutschen die Aktionen in eine eigene Zeile
          statt aus dem Bild (vorher waren sie im Logbuch nicht erreichbar). */}
      {aktionen && <div className="flex flex-wrap items-center gap-2 ml-auto">{aktionen}</div>}
    </div>
  );
}
