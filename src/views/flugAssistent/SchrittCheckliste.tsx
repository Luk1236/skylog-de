import { BrainCircuit } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import { ChecklistKarte, type Checkliste } from './checkliste';
import type { KiAnalyse } from './typen';

/** Schritt 2: die anpassbare Vorflug-Checkliste gibt den Start frei. */
export function SchrittCheckliste({ analyse, vorflug, onStart }: {
  analyse: KiAnalyse | null;
  vorflug: Checkliste;
  onStart: () => void;
}) {
  const { tx } = useSprache();
  const offen = vorflug.items.length - vorflug.done;

  return (
    <div className="ansicht-blenden">
      <div className="space-y-6 pb-32">
        {analyse && (
          <div className={cn(
            "p-4 rounded-3xl border flex items-center gap-4 transition-all",
            analyse.overall_safety_score > 70 ? "bg-emerald-50 border-emerald-100" :
            analyse.overall_safety_score > 40 ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"
          )}>
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
              analyse.overall_safety_score > 70 ? "bg-emerald-700 text-white" :
              analyse.overall_safety_score > 40 ? "bg-amber-700 text-white" : "bg-brand-red text-white"
            )}>
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{tx('KI-Sicherheits-Check', 'AI safety check')}</h4>
              <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-tight">
                {analyse.summary}
              </p>
            </div>
          </div>
        )}

        <ChecklistKarte liste={vorflug} titel={tx('Vorflug-Checkliste', 'Pre-flight checklist')} />
        <p className="text-xs text-slate-500 px-1 leading-relaxed">
          {tx('Die Punkte passt du über das Zahnrad an. Die Liste gilt für alle Flüge.', 'Adjust the items via the gear icon. The list applies to all flights.')}
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-50/80 backdrop-blur-md">
        <button
          disabled={!vorflug.vollstaendig}
          onClick={onStart}
          className="w-full max-w-md mx-auto block bg-brand-green text-white font-bold py-4 rounded-2xl shadow-xl shadow-brand-green/20 disabled:opacity-30 transition-all active:scale-95"
        >
          {tx('Startklar – Flug starten', 'Ready – start flight')}
        </button>
        {offen > 0 && (
          <p className="text-center text-xs font-bold text-slate-600 mt-2">
            {offen === 1
              ? tx('Noch 1 Punkt abhaken', '1 item left to check')
              : tx(`Noch ${offen} Punkte abhaken`, `${offen} items left to check`)}
          </p>
        )}
      </div>
    </div>
  );
}
