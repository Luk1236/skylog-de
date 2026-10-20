import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type KnopfVariante = 'primaer' | 'sekundaer' | 'gefahr' | 'geist';

const VARIANTE: Record<KnopfVariante, string> = {
  primaer: 'bg-brand-blue text-white shadow-sm hover:bg-brand-blue/90',
  sekundaer: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  gefahr: 'bg-brand-red text-white shadow-sm hover:bg-brand-red/90',
  geist: 'text-slate-600 hover:bg-slate-100',
};

// Beide Größen erfüllen das Touch-Ziel von mindestens 40 px (DESIGN.md).
const GROESSE = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-10 px-3 text-xs',
} as const;

const BASIS =
  'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-colors active:scale-[0.98] ' +
  'disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

/** Die Knopf-Klassen ohne <button> - z.B. für ein <label> einer Dateiauswahl,
 *  das wie ein Knopf aussehen soll. */
export function knopfKlassen(variante: KnopfVariante = 'primaer', groesse: keyof typeof GROESSE = 'md', voll = false): string {
  return cn(BASIS, VARIANTE[variante], GROESSE[groesse], voll && 'w-full');
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: KnopfVariante;
  groesse?: keyof typeof GROESSE;
  icon?: LucideIcon;
  /** Volle Breite. */
  voll?: boolean;
}

/** Der Knopf der App (siehe DESIGN.md). Ein `primaer` pro Bereich. */
export function Knopf({ variante = 'primaer', groesse = 'md', icon: Icon, voll, className, children, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={cn(knopfKlassen(variante, groesse, voll), className)} {...rest}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

const ICON_VARIANTE = {
  geist: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
  gefahr: 'text-slate-500 hover:bg-red-50 hover:text-brand-red',
  sekundaer: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
} as const;

interface IconProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** Pflicht: Symbol-Knöpfe brauchen eine Beschriftung für Screenreader. */
  'aria-label': string;
  variante?: keyof typeof ICON_VARIANTE;
}

/** Quadratischer Symbol-Knopf (40 × 40 px), z.B. Löschen in Listen. */
export function IconKnopf({ icon: Icon, variante = 'geist', className, type = 'button', ...rest }: IconProps) {
  return (
    <button
      type={type}
      className={cn('inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors shrink-0 disabled:opacity-50', ICON_VARIANTE[variante], className)}
      {...rest}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
