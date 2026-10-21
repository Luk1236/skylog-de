import { MapPin, Plane, Sparkles } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import type { Battery, Drone, Flight, Pilot, UserProfile } from '../../services/db';
import type { ForecastHour } from '../../services/weather';
import type { Notam } from '../../services/notam';
import { AirspaceCheckPanel } from '../../components/AirspaceCheckPanel';
import { AviationWeatherPanel } from '../../components/AviationWeatherPanel';
import { eingabe, beschriftung, knopfKlassen } from '../../components/ui';
import { KiHinweis } from './KiHinweis';
import { WetterKarte } from './WetterKarte';
import { Flugfenster } from './Flugfenster';
import { NotamKarte } from './NotamKarte';
import { RegelCheck } from './RegelCheck';
import type { AssistentWetter, KiAnalyse } from './typen';

/** Schritt 1: Fluggerät, Mission und Lage am Einsatzort. */
export function SchrittVorbereitung(p: {
  drones: Drone[];
  /** Akkus der gewählten Drohne (ohne Zuordnung: alle). */
  akkus: Battery[];
  piloten: Pilot[];
  profile: UserProfile | null;
  standort: [number, number];
  drohneId: string; setDrohneId: (id: string) => void;
  akkuId: string; setAkkuId: (id: string) => void;
  zweck: Flight['purpose']; setZweck: (z: Flight['purpose']) => void;
  pilotId: string; setPilotId: (id: string) => void;
  akkuStart: number; setAkkuStart: (n: number) => void;
  ortName: string; setOrtName: (s: string) => void;
  ki: { analyse: KiAnalyse | null; laeuft: boolean; fehler: string | null; starten: () => void };
  wetter: AssistentWetter; setWetter: (w: AssistentWetter) => void;
  sonnenuntergang: string | null;
  vorhersage: ForecastHour[];
  notams: { liste: Notam[]; laedt: boolean; fir: string };
  onWeiter: () => void;
}) {
  const { tx } = useSprache();
  const drohne = p.drones.find(d => d.id === p.drohneId);

  return (
    <div className="ansicht-blenden space-y-6 pb-24">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
          <Plane className="w-5 h-5 text-brand-blue" /> {tx('Fluggerät & Mission', 'Aircraft & mission')}
        </h3>
        <div className="space-y-4">
          <div>
            <label className={beschriftung} htmlFor="fa-drohne">{tx('Fluggerät', 'Aircraft')}</label>
            <select id="fa-drohne" className={eingabe} value={p.drohneId} onChange={e => p.setDrohneId(e.target.value)}>
              <option value="">{tx('Wähle Drohne...', 'Choose drone…')}</option>
              {p.drones.map(d => <option key={d.id} value={d.id}>{d.model}</option>)}
            </select>
          </div>
          <div>
            <label className={beschriftung} htmlFor="fa-akku">{tx('Akku', 'Battery')}</label>
            <select id="fa-akku" className={eingabe} value={p.akkuId} onChange={e => p.setAkkuId(e.target.value)}>
              <option value="">{tx('Wähle Akku...', 'Choose battery…')}</option>
              {p.akkus.map(b => <option key={b.id} value={b.id}>{b.number} ({b.cycles} {tx('Zyklen)', 'cycles)')}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={beschriftung} htmlFor="fa-zweck">{tx('Zweck', 'Purpose')}</label>
              <select id="fa-zweck" className={eingabe} value={p.zweck} onChange={e => p.setZweck(e.target.value as Flight['purpose'])}>
                <option value="Hobby">Hobby</option>
                <option value="Gewerblich">{tx('Gewerblich', 'Commercial')}</option>
                <option value="Inspektion">{tx('Inspektion', 'Inspection')}</option>
                <option value="Kamerafahrt">{tx('Kamerafahrt', 'Camera shot')}</option>
                <option value="Training">Training</option>
              </select>
            </div>
            <div>
              <label className={beschriftung} htmlFor="fa-pilot">Pilot</label>
              <select id="fa-pilot" className={eingabe} value={p.pilotId} onChange={e => p.setPilotId(e.target.value)}>
                <option value="main">{tx('Ich (Hauptpilot)', 'Me (pilot in command)')}</option>
                {p.piloten.map(pilot => (
                  <option key={pilot.id} value={pilot.id}>{pilot.name} {pilot.isGuest ? tx('(Gast)', '(guest)') : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={beschriftung} htmlFor="fa-akku-start">{tx('Akku beim Start (%)', 'Battery at start (%)')}</label>
              <input id="fa-akku-start" type="number" className={eingabe} value={p.akkuStart} onChange={e => p.setAkkuStart(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className={beschriftung} htmlFor="fa-ort">{tx('Name des Einsatzorts', 'Location name')}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input id="fa-ort"
                  type="text"
                  className={cn(eingabe, 'pl-10')}
                  placeholder={tx('z.B. Schlosspark', 'e.g. castle park')}
                  value={p.ortName}
                  onChange={e => p.setOrtName(e.target.value)}
                />
              </div>
              <button
                onClick={p.ki.starten}
                disabled={p.ki.laeuft}
                className={cn(
                  "h-11 px-3 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm font-bold shrink-0",
                  !p.ki.analyse ? "bg-brand-blue text-white shadow-sm" : "bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20"
                )}
                title={tx('KI-Sicherheitsanalyse starten', 'Start AI safety analysis')}
              >
                {/* Ruhig mit Textlabel statt dauerhaft pulsierendem Symbol */}
                {p.ki.laeuft ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {tx('KI-Check', 'AI check')}
              </button>
            </div>
          </div>

          <KiHinweis analyse={p.ki.analyse} laeuft={p.ki.laeuft} fehler={p.ki.fehler} />

          <WetterKarte wetter={p.wetter} setWetter={p.setWetter} drohne={drohne} sonnenuntergang={p.sonnenuntergang} />

          {/* Amtliche Geo-Zonen am Standort (dipul/DFS) */}
          <AirspaceCheckPanel lat={p.standort[0]} lon={p.standort[1]} />

          {/* Luftfahrtwetter der nächsten Flugplatz-Station (METAR/TAF) */}
          <AviationWeatherPanel lat={p.standort[0]} lon={p.standort[1]} />

          {/* 6h Wettervorhersage mit Flugfenster-Bewertung */}
          <Flugfenster vorhersage={p.vorhersage} maxWind={drohne?.maxWindSpeed ?? 28} sonnenuntergang={p.sonnenuntergang} />

          <NotamKarte
            aktiv={!!(p.profile?.notamClientId && p.profile?.notamClientSecret)}
            notams={p.notams.liste}
            laedt={p.notams.laedt}
            fir={p.notams.fir}
          />

          {drohne && <RegelCheck drohne={drohne} profil={p.profile} />}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center">
        <button
          // Akku ist optional - ohne angelegte Akkus kam man sonst nicht weiter.
          disabled={!p.drohneId}
          onClick={p.onWeiter}
          className={cn(knopfKlassen('primaer', 'md', true), 'max-w-md h-12')}
        >
          {tx('Weiter zur Checkliste', 'Continue to checklist')}
        </button>
      </div>
    </div>
  );
}
