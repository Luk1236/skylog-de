import { Camera, CheckCircle2, Thermometer, Wind } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import { beschriftung, knopfKlassen } from '../../components/ui';
import { ChecklistKarte, type Checkliste } from './checkliste';
import { formatZeit, summeSekunden, type Abschnitt, type AssistentWetter } from './typen';

/** Schritt 4: Flugbericht ergänzen und speichern. */
export function SchrittAbschluss(p: {
  abschnitte: Abschnitt[];
  akkuStart: number;
  akkuEnde: number; setAkkuEnde: (n: number) => void;
  wetter: AssistentWetter; setWetter: (w: AssistentWetter) => void;
  vorkommnisse: string; setVorkommnisse: (s: string) => void;
  foto: string | undefined; setFoto: (f: string | undefined) => void;
  nachflug: Checkliste;
  onSpeichern: () => void;
}) {
  const { tx } = useSprache();
  const minuten = Math.max(1, Math.round(summeSekunden(p.abschnitte) / 60));

  return (
    <div className="ansicht-blenden space-y-6 flex flex-col h-full">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10">
            <CheckCircle2 className="w-6 h-6 text-brand-blue" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">{tx('Flugbericht', 'Flight report')}</h3>
            <p className="text-xs text-slate-500 font-medium">{tx('Abschluss & Rückblick', 'Wrap-up & review')}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-1">{tx('Dauer', 'Duration')}</p>
              <p className="text-sm font-black text-slate-900">{minuten} Min</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-1">{tx('Verbrauch', 'Consumption')}</p>
              <p className="text-sm font-black text-slate-900">{p.akkuStart - p.akkuEnde}%</p>
            </div>
          </div>

          <ChecklistKarte liste={p.nachflug} titel={tx('Nachflug-Checkliste', 'Post-flight checklist')} />

          <div>
            <label className={beschriftung} htmlFor="fa-akku-ende">{tx('Akku am Ende (%)', 'Battery at the end (%)')}</label>
            <div className="flex items-center gap-4">
              <input id="fa-akku-ende"
                type="range"
                min="0"
                max={p.akkuStart}
                className="flex-1 h-1.5 bg-slate-100 rounded-full appearance-none accent-brand-blue"
                value={p.akkuEnde}
                onChange={e => p.setAkkuEnde(Number(e.target.value))}
              />
              <span className="text-sm font-black text-slate-900 w-12 text-right">{p.akkuEnde}%</span>
            </div>
          </div>

          <div>
            <p className={beschriftung}>{tx('Wetter beim Flug', 'Weather during the flight')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                <Thermometer className="w-4 h-4 text-slate-400" />
                <input type="number" aria-label={tx('Temperatur (°C)', 'Temperature (°C)')} className="w-full bg-transparent text-xs font-bold font-mono outline-none" value={p.wetter.temp} onChange={e => p.setWetter({ ...p.wetter, temp: Number(e.target.value) })} />
                <span className="text-2xs font-bold text-slate-400">°C</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                <Wind className="w-4 h-4 text-slate-400" />
                <input type="number" aria-label={tx('Wind (km/h)', 'Wind (km/h)')} className="w-full bg-transparent text-xs font-bold font-mono outline-none" value={p.wetter.windSpeed} onChange={e => p.setWetter({ ...p.wetter, windSpeed: Number(e.target.value) })} />
                <span className="text-2xs font-bold text-slate-400">km/h</span>
              </div>
            </div>
          </div>

          <div>
            <label className={beschriftung} htmlFor="fa-vorkommnis">{tx('Vorkommnisse / Anomalien', 'Occurrences / anomalies')}</label>
            <textarea id="fa-vorkommnis"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm min-h-[100px] outline-none"
              placeholder={tx('Waren Vögel, Passanten oder techn. Probleme präsent?', 'Were birds, passers-by or technical problems present?')}
              value={p.vorkommnisse}
              onChange={e => p.setVorkommnisse(e.target.value)}
            />
            <div className="mt-2">
              <p className={beschriftung}>{tx('Foto (optional)', 'Photo (optional)')}</p>
              {p.foto ? (
                <div className="relative">
                  <img src={p.foto} alt={tx('Vorkommnisfoto', 'Occurrence photo')} className="w-full max-h-40 object-cover rounded-xl border border-slate-200" />
                  <button
                    onClick={() => p.setFoto(undefined)}
                    aria-label={tx('Foto entfernen', 'Remove photo')}
                    className="absolute top-2 right-2 bg-brand-red text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                  >✕</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <Camera className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">{tx('Foto aufnehmen oder hochladen', 'Take or upload a photo')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => p.setFoto(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider ml-1">{tx('Flugabschnitte', 'Flight segments')}</p>
            <div className="space-y-1">
              {p.abschnitte.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50/50 rounded-xl border border-slate-100">
                  <span className="text-2xs font-bold text-slate-500">{tx(`Abschnitt ${i + 1}`, `Segment ${i + 1}`)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-2xs text-slate-500">{new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-2xs font-bold text-slate-900 font-mono">{formatZeit(a.duration)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pb-10 pt-4">
        <button
          onClick={p.onSpeichern}
          className={cn(knopfKlassen('primaer', 'md', true), 'h-12')}
        >
          {tx('Flug im Logbuch speichern', 'Save flight to logbook')}
        </button>
      </div>
    </div>
  );
}
