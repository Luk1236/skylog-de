import { History, Play, Square } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import { knopfKlassen } from '../../components/ui';
import { formatZeit, summeSekunden, type Abschnitt } from './typen';

/** Schritt 3: Flugzeit in Abschnitten stoppen. */
export function SchrittFlug({ laeuft, sekunden, abschnitte, onStart, onStop, onAbschliessen }: {
  laeuft: boolean;
  /** Sekunden des laufenden Abschnitts. */
  sekunden: number;
  abschnitte: Abschnitt[];
  onStart: () => void;
  onStop: () => void;
  onAbschliessen: () => void;
}) {
  const { tx } = useSprache();

  return (
    <div className="ansicht-blenden h-full flex flex-col items-center">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col items-center mb-8 w-full">
        <div className="w-48 h-48 rounded-full border-8 border-slate-50 flex items-center justify-center relative mb-8">
          <div className="text-center">
            <p className="text-5xl font-black text-slate-900 font-mono tracking-tight leading-none">{formatZeit(sekunden)}</p>
            <p className="text-xs font-bold text-slate-500 mt-2">{laeuft ? tx('In der Luft', 'In the air') : tx('Startbereit', 'Ready')}</p>
          </div>
          {laeuft && (
            <div className="ansicht-blenden absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-red text-white text-2xs px-3 py-1 rounded-full font-bold tracking-wider animate-pulse">
              {tx('Flug läuft', 'Flying')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-6">
          {!laeuft ? (
            <button
              onClick={onStart}
              aria-label={tx('Flugabschnitt starten', 'Start flight segment')}
              className="bg-brand-blue text-white w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl shadow-brand-blue/30 active:scale-90 transition-all group"
            >
              <Play className="w-8 h-8 fill-current group-hover:scale-110 transition-transform" />
            </button>
          ) : (
            <button
              onClick={onStop}
              aria-label={tx('Flugabschnitt beenden', 'End flight segment')}
              className="bg-brand-red text-white w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl shadow-brand-red/30 active:scale-90 transition-all group"
            >
              <Square className="w-8 h-8 fill-current group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      </div>

      <div className="w-full bg-white rounded-3xl border border-slate-200 p-6 flex-1 overflow-hidden flex flex-col mb-24">
        <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-bold text-slate-900">{tx('Flugabschnitte', 'Flight segments')}</h4>
          </div>
          <span className="text-2xs font-bold text-brand-blue bg-brand-blue/5 px-2 py-1 rounded-full">{tx('Abschnitt', 'Segment')} {abschnitte.length + (laeuft ? 1 : 0)}</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
          {abschnitte.map((a, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100/50">
              <div className="flex flex-col">
                <span className="text-2xs font-bold text-slate-500 leading-none mb-1">{tx(`Abschnitt ${i + 1}`, `Segment ${i + 1}`)}</span>
                <span className="text-2xs font-bold text-slate-600">{new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <span className="text-sm font-bold text-slate-900 font-mono tracking-tight">{formatZeit(a.duration)}</span>
            </div>
          ))}
          {abschnitte.length === 0 && !laeuft && (
            <div className="text-center py-12">
              <p className="text-slate-500 font-bold text-sm">{tx('Drück auf Start, sobald die Drohne abhebt.', 'Press start as soon as the drone takes off.')}</p>
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">{tx('Gesamtflugzeit', 'Total flight time')}</span>
          <span className="text-xl font-black text-brand-blue font-mono tracking-tight">
            {/* Der laufende Abschnitt zählt nur, solange er läuft - nach dem Stopp
                steckt er schon in den Abschnitten (vorher doppelt gezählt). */}
            {formatZeit(summeSekunden(abschnitte) + (laeuft ? sekunden : 0))}
          </span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center">
        <button
          disabled={abschnitte.length === 0 && !laeuft}
          onClick={onAbschliessen}
          className={cn(knopfKlassen('primaer', 'md', true), 'max-w-md h-12')}
        >
          {tx('Flug abschließen', 'Finish flight')}
        </button>
      </div>
    </div>
  );
}
