import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import { wetterText, type ForecastHour } from '../../services/weather';
import { bewerteFlugfenster, besteStunde, sonnenuntergangStunde, type FensterBewertung } from '../../services/flightWindow';

const RAHMEN: Record<FensterBewertung, string> = {
  gut: 'border-brand-green/50 bg-brand-green/5',
  grenzwertig: 'border-amber-400/60 bg-amber-50',
  schlecht: 'border-brand-red/40 bg-brand-red/5',
  nacht: 'border-slate-300 bg-slate-100',
};

/** Wettervorhersage der nächsten Stunden mit Flugfenster-Bewertung je Stunde. */
export function Flugfenster({ vorhersage, maxWind, sonnenuntergang }: {
  vorhersage: ForecastHour[];
  maxWind: number;
  sonnenuntergang: string | null;
}) {
  const { tx, sprache } = useSprache();
  if (vorhersage.length === 0) return null;

  const fenster = bewerteFlugfenster(vorhersage, maxWind, sonnenuntergangStunde(sonnenuntergang));
  const beste = besteStunde(fenster);

  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
      <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">{tx('6-h-Flugfenster', '6 h flight window')}</p>
      <p className="text-xs text-slate-500 mb-2 text-center">
        {beste
          ? <>{tx('Beste Zeit:', 'Best time:')} <span className="font-bold text-brand-green">{beste.time}</span> ({beste.maxWindKmh} km/h)</>
          : <span className="font-bold text-brand-red">{tx('Keine geeignete Stunde in den nächsten 6 h', 'No suitable hour in the next 6 h')}</span>}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {vorhersage.map((h, i) => (
          <div key={i} className={cn('flex flex-col items-center gap-1 min-w-[64px] rounded-xl p-2 border shrink-0', RAHMEN[fenster[i].bewertung])}>
            <span className="text-2xs font-bold text-brand-blue">{h.time}</span>
            <span className="text-xs font-bold text-slate-800">{h.temp}°</span>
            {/* Bodenwind / Wind auf Flughöhe — der obere Wert ist der relevante. */}
            <span className={cn("text-2xs font-bold", h.windSpeed > 15 ? "text-brand-red" : "text-slate-500")}>{h.windSpeed}km/h</span>
            {h.windSpeed120 > 0 && (
              <span className={cn("text-2xs font-bold", h.windSpeed120 > 20 ? "text-brand-red" : "text-slate-400")}>
                ↑{h.windSpeed120}
              </span>
            )}
            {h.windGusts > 0 && (
              <span className={cn("text-2xs font-bold", h.windGusts > 25 ? "text-brand-red" : "text-slate-400")}>
                ⇡{h.windGusts}
              </span>
            )}
            <span className="text-2xs text-slate-400 leading-tight text-center">{wetterText(h.condition, sprache)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
