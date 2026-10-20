import { useEffect, useId, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSprache } from '../../lib/sprache';

export type DialogTon = 'blau' | 'gruen' | 'bernstein' | 'rot';

const TON: Record<DialogTon, string> = {
  blau: 'bg-brand-blue/10 text-brand-blue',
  gruen: 'bg-emerald-50 text-brand-green',
  bernstein: 'bg-amber-50 text-amber-700',
  rot: 'bg-red-50 text-brand-red',
};

const BREITE = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
} as const;

interface Props {
  titel: ReactNode;
  untertitel?: ReactNode;
  icon?: LucideIcon;
  ton?: DialogTon;
  breite?: keyof typeof BREITE;
  onClose: () => void;
  /** Knöpfe unten (fest, scrollt nicht mit). */
  fuss?: ReactNode;
  /** Zusätzliche Knöpfe im Kopf neben „Schließen". */
  kopfAktionen?: ReactNode;
  /** Klick auf den abgedunkelten Hintergrund schließt (Standard: ja). */
  schliesstBeiKlickDaneben?: boolean;
  /** Ohne Innenabstand im Inhalt (z.B. für Karten, die bis zum Rand gehen). */
  ohneInnenabstand?: boolean;
  /** false: kein Schließen-Knopf, Escape und Klick daneben wirken nicht
   *  (z.B. die PIN-Sperre beim Entsperren). Standard: true. */
  schliessbar?: boolean;
  children: ReactNode;
}

/** Der eine Dialog-Aufbau der App (siehe DESIGN.md): auf dem Handy von unten
 *  aufsteigend, ab `sm` zentriert. Kopf mit Icon-Kachel, Titel und Schließen,
 *  scrollbarer Inhalt, optional ein fester Fuß für die Aktionen. */
export function Dialog({
  titel, untertitel, icon: Icon, ton = 'blau', breite = 'md', onClose, fuss, kopfAktionen,
  schliesstBeiKlickDaneben = true, ohneInnenabstand = false, schliessbar = true, children,
}: Props) {
  const { tx } = useSprache();
  const titelId = useId();

  useEffect(() => {
    if (!schliessbar) return;
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose, schliessbar]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={schliessbar && schliesstBeiKlickDaneben ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        className={cn('bg-white w-full rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col', BREITE[breite])}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          {Icon && (
            <div className={cn('p-2.5 rounded-2xl shrink-0', TON[ton])}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titelId} className="text-base font-black text-slate-900 leading-tight">{titel}</h2>
            {untertitel && <p className="text-xs text-slate-500 mt-0.5">{untertitel}</p>}
          </div>
          {kopfAktionen}
          {schliessbar && <button
            onClick={onClose}
            aria-label={tx('Schließen', 'Close')}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>}
        </div>
        <div className={cn('overflow-y-auto flex-1', !ohneInnenabstand && 'px-5 py-5 space-y-4')}>
          {children}
        </div>
        {fuss && (
          <div className="px-5 py-4 border-t border-slate-100 shrink-0 flex gap-2 pb-safe">
            {fuss}
          </div>
        )}
      </div>
    </div>
  );
}
