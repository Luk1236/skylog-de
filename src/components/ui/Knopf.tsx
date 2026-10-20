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

const GROESSE = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-xs',
} as const;

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
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        VARIANTE[variante], GROESSE[groesse], voll && 'w-full', className,
      )}
      {...rest}
    >
      {Icon && <Icon className={groesse === 'sm' ? 'w-4 h-4' : 'w-4 h-4'} />}
      {children}
    </button>
  );
}
