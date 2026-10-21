import { Clock, Wind } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { minutesUntilSunset } from '../../services/weather';
import type { Drone } from '../../services/db';
import type { AssistentWetter } from './typen';

const feld = 'w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs';

/** Wetterwerte zum Nachjustieren, Windgrenze der Drohne und Sonnenuntergang. */
export function WetterKarte({ wetter, setWetter, drohne, sonnenuntergang }: {
  wetter: AssistentWetter;
  setWetter: (w: AssistentWetter) => void;
  drohne: Drone | undefined;
  sonnenuntergang: string | null;
}) {
  const { tx } = useSprache();
  const minutenBisDunkel = minutesUntilSunset(sonnenuntergang);

  // Drohnen-spezifische Windgrenze. Geprüft wird nicht nur der Bodenwind: auf
  // Flughöhe (120 m) weht es meist stärker, und Böen sind für die Drohne
  // kritischer als der Mittelwind. Es zählt der ungünstigste der drei Werte.
  const limit = drohne?.maxWindSpeed ?? 28;
  const schlimmster = [
    { wert: wetter.windSpeed, quelle: tx('am Boden', 'on the ground') },
    { wert: wetter.windSpeed120, quelle: tx('auf 120 m Flughöhe', 'at 120 m altitude') },
    { wert: wetter.windGusts, quelle: tx('in Böen', 'in gusts') },
  ].filter(k => k.wert > 0).reduce((max, k) => (k.wert > max.wert ? k : max), { wert: 0, quelle: '' });

  return (
    <>
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">{tx('Wetterbedingungen', 'Weather conditions')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-slate-500 block mb-1">{tx('Temp / Wind', 'Temp / wind')}</span>
            <div className="flex items-center gap-1">
              <input type="number" aria-label={tx('Temperatur (°C)', 'Temperature (°C)')} className={feld} value={wetter.temp} onChange={e => setWetter({ ...wetter, temp: Number(e.target.value) })} />
              <input type="number" aria-label={tx('Wind am Boden (km/h)', 'Ground wind (km/h)')} className={feld} value={wetter.windSpeed} onChange={e => setWetter({ ...wetter, windSpeed: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500 block mb-1">{tx('Sicht / K-Index', 'Visibility / K index')}</span>
            <div className="flex items-center gap-1">
              <input type="text" aria-label={tx('Sicht', 'Visibility')} className={feld} value={wetter.visibility} onChange={e => setWetter({ ...wetter, visibility: e.target.value })} />
              <input type="number" aria-label={tx('Kp-Index', 'Kp index')} className={feld} value={wetter.kIndex} onChange={e => setWetter({ ...wetter, kIndex: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      </div>

      {drohne && schlimmster.wert > limit && (
        <div className="flex items-center gap-3 p-4 bg-brand-red/5 border border-brand-red/20 rounded-2xl">
          <Wind className="w-5 h-5 text-brand-red shrink-0" />
          <div>
            <p className="text-xs font-bold text-brand-red">{tx('Wind über Limit für', 'Wind above the limit for')} {drohne.model}!</p>
            <p className="text-2xs text-slate-500">
              {schlimmster.wert} km/h {schlimmster.quelle} · Max {limit} {tx('km/h laut Spezifikation', 'km/h according to spec')}
            </p>
            {wetter.windSpeed120 > wetter.windSpeed && (
              <p className="text-2xs text-slate-500 mt-0.5">
                {tx('Am Boden nur', 'Only')} {wetter.windSpeed} {tx('km/h — oben ist es deutlich windiger.', 'km/h on the ground — it is much windier up there.')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sonnenuntergang: ab da braucht die Drohne Kennzeichnung/Blinklicht. */}
      {minutenBisDunkel !== null && minutenBisDunkel <= 90 && (
        <div className="flex items-center gap-3 p-4 bg-brand-yellow/5 border border-brand-yellow/30 rounded-2xl">
          <Clock className="w-5 h-5 text-brand-yellow shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-800">
              {tx('Sonnenuntergang in', 'Sunset in')} {minutenBisDunkel < 60 ? `${minutenBisDunkel} Min` : `${Math.floor(minutenBisDunkel / 60)} Std ${minutenBisDunkel % 60} Min`}
            </p>
            <p className="text-2xs text-slate-500">
              {tx('Danach ist Nachtflug — die Drohne braucht ein blinkendes grünes Positionslicht.', 'After that it is a night flight — the drone needs a flashing green position light.')}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
