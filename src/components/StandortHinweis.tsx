import { LocateFixed, X } from 'lucide-react';
import { useSprache } from '../lib/sprache';

/** Erklärt auf der Karte, wofür die App den Standort braucht. Erst der Tipp auf
 *  „Freigeben" löst die Abfrage des Browsers bzw. von Android aus. */
export function StandortHinweis({ onFreigeben, onVonHand, onSchliessen }: {
  onFreigeben: () => void,
  onVonHand: () => void,
  /** Nicht mehr fragen - der Orten-Knopf der Karte bleibt jederzeit nutzbar. */
  onSchliessen: () => void,
}) {
  const { tx } = useSprache();
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 p-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
          <LocateFixed className="w-4 h-4 text-brand-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">{tx('Standort freigeben?', 'Share your location?')}</p>
          <p className="text-xs text-slate-600 leading-snug">
            {tx('Für Flugzonen, Wetter und Notfall-Koordinaten an deinem Ort.', 'For flight zones, weather and emergency coordinates where you are.')}
          </p>
        </div>
        <button
          type="button"
          onClick={onSchliessen}
          aria-label={tx('Nicht mehr fragen', 'Do not ask again')}
          className="w-8 h-8 -mt-1 -mr-1 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onFreigeben}
          className="flex-1 h-10 rounded-xl bg-brand-blue text-white text-sm font-bold"
        >
          {tx('Freigeben', 'Allow')}
        </button>
        <button
          type="button"
          onClick={onVonHand}
          className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
        >
          {tx('Von Hand', 'Set manually')}
        </button>
      </div>
    </div>
  );
}
