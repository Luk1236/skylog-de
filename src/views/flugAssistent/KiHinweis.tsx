import { AlertTriangle, BrainCircuit, Info } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import type { KiAnalyse } from './typen';

/** Empfehlung, Fehler oder Ergebnis der KI-Sicherheitsanalyse im Vorbereitungs-Schritt. */
export function KiHinweis({ analyse, laeuft, fehler }: {
  analyse: KiAnalyse | null;
  laeuft: boolean;
  fehler: string | null;
}) {
  const { tx } = useSprache();

  if (!analyse && !laeuft && !fehler) {
    return (
      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
        <BrainCircuit className="w-5 h-5 text-brand-blue shrink-0" />
        <div>
          <p className="text-xs font-bold text-brand-blue">{tx('KI-Empfehlung', 'AI recommendation')}</p>
          <p className="text-xs text-slate-500 font-medium">{tx('Lasse den Ort auf versteckte Hindernisse analysieren, bevor du startest.', 'Have the location analysed for hidden obstacles before you take off.')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {fehler && !laeuft && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 font-medium leading-relaxed">{fehler}</p>
        </div>
      )}

      {analyse && (
        <div className="ansicht-blenden p-5 bg-white text-slate-900 rounded-3xl shadow-sm overflow-hidden border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-brand-blue" />
              <h4 className="text-sm font-bold">{tx('KI-Sicherheitsanalyse', 'AI safety analysis')}</h4>
            </div>
            <div className={cn(
              "px-2 py-0.5 rounded-full text-xs font-bold",
              analyse.overall_safety_score > 80 ? "bg-emerald-50 text-brand-green" :
              analyse.overall_safety_score > 50 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-brand-red"
            )}>
              {analyse.overall_safety_score} / 100
            </div>
          </div>

          <p className="text-sm text-slate-600 italic mb-4 leading-relaxed">
            "{analyse.summary}"
          </p>

          <div className="space-y-3">
            {analyse.obstacles.map((obs, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-brand-blue">{obs.type}</span>
                  <span className={cn(
                    "text-2xs font-bold px-2 py-0.5 rounded-full",
                    obs.severity === 'High' ? "bg-red-50 text-brand-red" :
                    obs.severity === 'Medium' ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-brand-green"
                  )}>
                    {obs.severity === 'High' ? tx('hoch', 'high') : obs.severity === 'Medium' ? tx('mittel', 'medium') : tx('gering', 'low')}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mb-2 leading-snug">{obs.description}</p>
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200">
                  <Info className="w-3 h-3 text-brand-blue" />
                  <span className="text-xs font-medium text-slate-600">{obs.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
