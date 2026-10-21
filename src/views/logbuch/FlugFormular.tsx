import { MapPin, Moon, Timer } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import type { Battery, Drone, Flight } from '../../services/db';
import { Feld, Knopf, eingabe } from '../../components/ui';
import { zwecke } from './neuerFlug';

/** Flug von Hand eintragen. */
export function FlugFormular({ flug, setFlug, drones, batteries, heute, onFavoriten, onAssistent, onSpeichern }: {
  flug: Partial<Flight>;
  setFlug: (f: Partial<Flight>) => void;
  drones: Drone[];
  batteries: Battery[];
  /** Heutiges Datum (YYYY-MM-DD) - später geht nicht. */
  heute: string;
  onFavoriten?: () => void;
  onAssistent: () => void;
  onSpeichern: () => void;
}) {
  const { tx } = useSprache();

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 mb-6" id="flug-formular">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-black text-slate-900">{tx('Flug eintragen', 'Log a flight')}</h3>
        <button type="button" onClick={onAssistent} className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1 shrink-0">
          <Timer className="w-3.5 h-3.5" /> {tx('Lieber mit Assistent', 'Use the assistant')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Feld label={tx('Drohne', 'Drone')} htmlFor="lb-drohne">
          <select id="lb-drohne" className={eingabe} value={flug.droneId || ''} onChange={e => setFlug({ ...flug, droneId: e.target.value })}>
            <option value="">{tx('Wählen …', 'Choose…')}</option>
            {drones.map(d => <option key={d.id} value={d.id}>{d.model}</option>)}
          </select>
        </Feld>
        <Feld label={tx('Akku', 'Battery')} htmlFor="lb-akku">
          <select id="lb-akku" className={eingabe} value={flug.batteryId || ''} onChange={e => setFlug({ ...flug, batteryId: e.target.value })}>
            <option value="">{tx('Keiner', 'None')}</option>
            {batteries.map(b => <option key={b.id} value={b.id}>{b.number}</option>)}
          </select>
        </Feld>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Feld label={tx('Datum', 'Date')} htmlFor="lb-datum">
          <input id="lb-datum" type="date" className={eingabe} value={flug.date || ''} max={heute} onChange={e => setFlug({ ...flug, date: e.target.value })} />
        </Feld>
        <Feld label={tx('Dauer (Minuten)', 'Duration (minutes)')} htmlFor="lb-dauer">
          <input id="lb-dauer" type="number" min={1} inputMode="numeric" className={eingabe} placeholder="15" value={flug.duration || ''} onChange={e => setFlug({ ...flug, duration: Number(e.target.value) })} />
        </Feld>
      </div>
      <Feld
        label={
          <span className="flex items-center justify-between">
            <span>{tx('Einsatzort', 'Location')}</span>
            {onFavoriten && (
              <button type="button" onClick={onFavoriten} className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {tx('Favoriten', 'Favourites')}
              </button>
            )}
          </span>
        }
        htmlFor="lb-ort"
      >
        <input id="lb-ort" type="text" className={eingabe} placeholder={tx('z. B. Griesheim, Flugplatz', 'e.g. Griesheim, airfield')} value={flug.locationName || ''} onChange={e => setFlug({ ...flug, locationName: e.target.value })} />
      </Feld>
      <div className="grid grid-cols-2 gap-3">
        <Feld label={tx('Zweck', 'Purpose')} htmlFor="lb-zweck">
          <select id="lb-zweck" className={eingabe} value={flug.purpose || 'Hobby'} onChange={e => setFlug({ ...flug, purpose: e.target.value as Flight['purpose'] })}>
            {zwecke(tx).map(z => <option key={z.wert} value={z.wert}>{z.label}</option>)}
          </select>
        </Feld>
        <Feld label={tx('Co-Pilot / Beobachter', 'Co-pilot / observer')} htmlFor="lb-copilot">
          <input id="lb-copilot" type="text" className={eingabe} placeholder={tx('Name (optional)', 'Name (optional)')} value={flug.coPilotName || ''} onChange={e => setFlug({ ...flug, coPilotName: e.target.value })} />
        </Feld>
      </div>
      <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer text-sm font-medium text-slate-700">
        <input type="checkbox" checked={!!flug.isNightFlight} onChange={e => setFlug({ ...flug, isNightFlight: e.target.checked })} className="rounded text-brand-blue" />
        <Moon className="w-4 h-4 text-brand-blue" />
        {tx('Nachtflug', 'Night flight')}
      </label>
      <Knopf voll onClick={onSpeichern} disabled={!flug.droneId || !flug.date}>{tx('Flug speichern', 'Save flight')}</Knopf>
    </div>
  );
}
