import { useSprache } from '../lib/sprache';
import { useState } from 'react';
import { X, AlertTriangle, Copy, Check, ExternalLink, ClipboardCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import type { UserProfile, Drone } from '../services/db';
import {
  baueVorfallBericht,
  fehlendePflichtfelder,
  VORFALL_KATEGORIEN,
  type VorfallEingabe,
  type VorfallKategorie,
} from '../services/incidentReport';

interface Props {
  profile: UserProfile | null;
  drohnen: Drone[];
  onClose: () => void;
}

const heute = () => new Date().toISOString().split('T')[0];
const jetztUhr = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const feld = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm';
const beschriftung = 'text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1 block';

export function IncidentReportDialog({ profile, drohnen, onClose }: Props) {
  const { tx } = useSprache();
  const [datum, setDatum] = useState(heute());
  const [uhrzeit, setUhrzeit] = useState(jetztUhr());
  const [ort, setOrt] = useState('');
  const [drohnenId, setDrohnenId] = useState(drohnen[0]?.id ?? '');
  const [kategorie, setKategorie] = useState<VorfallKategorie>('Kontrollverlust');
  const [beschreibung, setBeschreibung] = useState('');
  const [personenschaden, setPersonenschaden] = useState(false);
  const [personenschadenDetails, setPersonenschadenDetails] = useState('');
  const [sachschaden, setSachschaden] = useState(false);
  const [sachschadenDetails, setSachschadenDetails] = useState('');
  const [zeugen, setZeugen] = useState('');
  const [massnahmen, setMassnahmen] = useState('');
  const [kopiert, setKopiert] = useState(false);

  const eingabe: VorfallEingabe = {
    datum, uhrzeit, ort,
    drohne: drohnen.find(d => d.id === drohnenId) ?? null,
    betreiber: profile,
    kategorie, beschreibung,
    personenschaden, personenschadenDetails,
    sachschaden, sachschadenDetails,
    zeugen, massnahmen,
  };

  // Reine, billige Funktionen - ein useMemo auf das jedes Mal neue eingabe-Objekt brachte nichts.
  const fehlt = fehlendePflichtfelder(eingabe);
  const bericht = baueVorfallBericht(eingabe);

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(bericht);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } catch {
      setKopiert(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-brand-red" />
            <h3 className="font-black text-slate-900">{tx('Vorfall-Bericht', 'Incident report')}</h3>
          </div>
          <button onClick={onClose} aria-label={tx('Schließen', 'Close')} className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={beschriftung}>{tx('Datum', 'Date')}</label>
              <input type="date" className={feld} value={datum} onChange={e => setDatum(e.target.value)} />
            </div>
            <div>
              <label className={beschriftung}>{tx('Uhrzeit', 'Time')}</label>
              <input type="time" className={feld} value={uhrzeit} onChange={e => setUhrzeit(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={beschriftung}>{tx('Ort', 'Location')}</label>
            <input className={feld} value={ort} placeholder={tx('z.B. Feldweg bei Griesheim', 'e.g. field path near Griesheim')} onChange={e => setOrt(e.target.value)} />
          </div>

          {drohnen.length > 0 && (
            <div>
              <label className={beschriftung}>{tx('Drohne', 'Drone')}</label>
              <select className={feld} value={drohnenId} onChange={e => setDrohnenId(e.target.value)}>
                {drohnen.map(d => <option key={d.id} value={d.id}>{d.name || d.model}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={beschriftung}>{tx('Kategorie', 'Category')}</label>
            <select className={feld} value={kategorie} onChange={e => setKategorie(e.target.value as VorfallKategorie)}>
              {VORFALL_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div>
            <label className={beschriftung}>{tx('Beschreibung des Vorfalls', 'Description of the incident')}</label>
            <textarea className={cn(feld, 'min-h-[90px] resize-y')} value={beschreibung}
              placeholder={tx('Was ist passiert? Ablauf, Ursache, Umgebung…', 'What happened? Sequence, cause, surroundings…')}
              onChange={e => setBeschreibung(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={personenschaden} onChange={e => setPersonenschaden(e.target.checked)} />
            {tx('Personenschaden', 'Personal injury')}
          </label>
          {personenschaden && (
            <input className={feld} value={personenschadenDetails} placeholder={tx('Art der Verletzung, betroffene Person', 'Type of injury, person affected')}
              onChange={e => setPersonenschadenDetails(e.target.value)} />
          )}

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={sachschaden} onChange={e => setSachschaden(e.target.checked)} />
            {tx('Sachschaden', 'Property damage')}
          </label>
          {sachschaden && (
            <input className={feld} value={sachschadenDetails} placeholder={tx('Beschädigte Sache', 'Damaged property')}
              onChange={e => setSachschadenDetails(e.target.value)} />
          )}

          <div>
            <label className={beschriftung}>{tx('Zeugen (optional)', 'Witnesses (optional)')}</label>
            <input className={feld} value={zeugen} onChange={e => setZeugen(e.target.value)} />
          </div>
          <div>
            <label className={beschriftung}>{tx('Sofortmaßnahmen (optional)', 'Immediate actions (optional)')}</label>
            <input className={feld} value={massnahmen} onChange={e => setMassnahmen(e.target.value)} />
          </div>

          {fehlt.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-2xs text-amber-700 font-medium">
                {tx('Für eine vollständige Meldung fehlt noch:', 'Still missing for a complete report:')} {fehlt.join(', ')}.
              </p>
            </div>
          )}

          <div>
            <label className={beschriftung}>{tx('Vorschau', 'Preview')}</label>
            <pre className="text-2xs leading-relaxed bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
              {bericht}
            </pre>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 shrink-0 space-y-2">
          <button onClick={kopieren}
            className={cn('w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-sm active:scale-95 transition-all',
              kopiert ? 'bg-brand-green text-white' : 'bg-brand-blue text-white')}>
            {kopiert ? <><Check className="w-4 h-4" /> {tx('In Zwischenablage kopiert', 'Copied to clipboard')}</> : <><Copy className="w-4 h-4" /> {tx('Bericht kopieren', 'Copy report')}</>}
          </button>
          <a href="https://www.lba.de/DE/Betrieb/Drohnen/Meldung_Ereignisse/Meldung_Ereignisse_node.html"
            target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-sm active:scale-95 transition-all">
            <ExternalLink className="w-4 h-4" /> {tx('LBA-Meldeportal öffnen', 'Open LBA reporting portal')}
          </a>
          <p className="flex items-start gap-1.5 text-2xs text-slate-400 leading-relaxed pt-1">
            <ClipboardCheck className="w-3 h-3 shrink-0 mt-0.5" />
            {tx('Bericht kopieren, LBA-Portal öffnen und dort einfügen. Schwere Ereignisse binnen 72 Stunden melden.', 'Copy the report, open the LBA portal and paste it there. Report serious occurrences within 72 hours.')}
          </p>
        </div>
      </div>
    </div>
  );
}
