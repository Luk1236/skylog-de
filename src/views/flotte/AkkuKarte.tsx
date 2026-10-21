import { Trash2, Zap } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import type { Battery } from '../../services/db';
import { effektiveGesundheit } from '../../services/batteryHealth';
import { IconKnopf } from '../../components/ui';

/** Karte eines Akkus mit Gesundheit (SOH) und Zyklen; Tipp öffnet die Details. */
export function AkkuKarte({ akku, onOeffnen, onLoeschen }: {
  akku: Battery;
  onOeffnen: () => void;
  onLoeschen: () => void;
}) {
  const { tx } = useSprache();
  const zyklen = akku.cycles || 0;
  // Erfasster SOH, sonst aus Zyklen geschätzt (0,15 %/Zyklus, Boden 60 %).
  const gesundheit = effektiveGesundheit(akku);
  const stufe = gesundheit < 50 ? 'schlecht' : gesundheit < 80 ? 'mittel' : 'gut';
  const flaeche = { schlecht: 'bg-red-50 text-brand-red', mittel: 'bg-amber-50 text-amber-800', gut: 'bg-emerald-50 text-brand-green' }[stufe];

  return (
    <div
      onClick={onOeffnen}
      className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
    >
      {/* Balken proportional zur Gesundheit */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-1.5 transition-all duration-700",
          stufe === 'schlecht' ? "bg-brand-red" : stufe === 'mittel' ? "bg-amber-400" : "bg-brand-green"
        )}
        style={{ width: `${gesundheit}%` }}
      />

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", flaeche)}>
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{akku.number}</h3>
            <p className="text-xs text-slate-500">{zyklen} {tx('Zyklen', 'Cycles')}</p>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1">
            <p className={cn("text-2xl font-black transition-colors", gesundheit < 30 ? "text-brand-red" : "text-slate-900")}>{gesundheit}%</p>
            <p className="text-2xs font-bold text-slate-500">SOH</p>
          </div>
          <span className={cn("inline-block mt-1 text-2xs font-bold px-2 py-0.5 rounded-full", flaeche)}>
            {gesundheit > 80 ? tx('Exzellent', 'Excellent') : gesundheit > 50 ? tx('Gut', 'Good') : tx('Verschlissen', 'Worn out')}
          </span>
        </div>
        <IconKnopf
          icon={Trash2}
          variante="gefahr"
          aria-label={tx('Akku löschen', 'Delete battery')}
          className="-mr-2 -mb-1 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={e => { e.stopPropagation(); onLoeschen(); }}
        />
      </div>
    </div>
  );
}
