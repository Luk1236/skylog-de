import { useSprache } from '../lib/sprache';
import { useState } from 'react';
import { AlertTriangle, Copy, Check, ExternalLink, ClipboardCheck } from 'lucide-react';
import { cn, lokalesDatum } from '../lib/utils';
import type { UserProfile, Drone } from '../services/db';
import {
  baueVorfallBericht,
  fehlendePflichtfelder,
  VORFALL_KATEGORIEN,
  type VorfallEingabe,
  type VorfallKategorie,
} from '../services/incidentReport';
import { Dialog, Knopf, Feld, eingabe as eingabeKlasse, beschriftung } from './ui';

interface Props {
  profile: UserProfile | null;
  drohnen: Drone[];
  onClose: () => void;
}

const heute = () => lokalesDatum();
const jetztUhr = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });


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
    <Dialog
      titel={tx('Vorfall-Bericht', 'Incident report')}
      icon={AlertTriangle}
      ton="rot"
      breite="md"
      onClose={onClose}
      schliesstBeiKlickDaneben={false}
      fuss={
        <div className="w-full space-y-2">
          <Knopf voll onClick={kopieren} className={cn(kopiert && 'bg-brand-green hover:bg-brand-green/90')}>
            {kopiert ? <><Check className="w-4 h-4" /> {tx('In Zwischenablage kopiert', 'Copied to clipboard')}</> : <><Copy className="w-4 h-4" /> {tx('Bericht kopieren', 'Copy report')}</>}
          </Knopf>
          <a href="https://www.lba.de/DE/Betrieb/Drohnen/Meldung_Ereignisse/Meldung_Ereignisse_node.html"
            target="_blank" rel="noopener noreferrer"
            className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl text-sm transition-colors active:scale-[0.98]">
            <ExternalLink className="w-4 h-4" /> {tx('LBA-Meldeportal öffnen', 'Open LBA reporting portal')}
          </a>
          <p className="flex items-start gap-1.5 text-2xs text-slate-500 leading-relaxed pt-1">
            <ClipboardCheck className="w-3 h-3 shrink-0 mt-0.5" />
            {tx('Bericht kopieren, LBA-Portal öffnen und dort einfügen. Schwere Ereignisse binnen 72 Stunden melden.', 'Copy the report, open the LBA portal and paste it there. Report serious occurrences within 72 hours.')}
          </p>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Feld label={tx('Datum', 'Date')} htmlFor="vorfall-datum">
          <input id="vorfall-datum" type="date" className={eingabeKlasse} value={datum} onChange={e => setDatum(e.target.value)} />
        </Feld>
        <Feld label={tx('Uhrzeit', 'Time')} htmlFor="vorfall-uhrzeit">
          <input id="vorfall-uhrzeit" type="time" className={eingabeKlasse} value={uhrzeit} onChange={e => setUhrzeit(e.target.value)} />
        </Feld>
      </div>

      <Feld label={tx('Ort', 'Location')} htmlFor="vorfall-ort">
        <input id="vorfall-ort" className={eingabeKlasse} value={ort} placeholder={tx('z.B. Feldweg bei Griesheim', 'e.g. field path near Griesheim')} onChange={e => setOrt(e.target.value)} />
      </Feld>

      {drohnen.length > 0 && (
        <Feld label={tx('Drohne', 'Drone')} htmlFor="vorfall-drohne">
          <select id="vorfall-drohne" className={eingabeKlasse} value={drohnenId} onChange={e => setDrohnenId(e.target.value)}>
            {drohnen.map(d => <option key={d.id} value={d.id}>{d.name || d.model}</option>)}
          </select>
        </Feld>
      )}

      <Feld label={tx('Kategorie', 'Category')} htmlFor="vorfall-kategorie">
        <select id="vorfall-kategorie" className={eingabeKlasse} value={kategorie} onChange={e => setKategorie(e.target.value as VorfallKategorie)}>
          {VORFALL_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </Feld>

      <Feld label={tx('Beschreibung des Vorfalls', 'Description of the incident')} htmlFor="vorfall-beschreibung">
        <textarea id="vorfall-beschreibung" className={cn(eingabeKlasse, 'min-h-24 resize-y')} value={beschreibung}
          placeholder={tx('Was ist passiert? Ablauf, Ursache, Umgebung…', 'What happened? Sequence, cause, surroundings…')}
          onChange={e => setBeschreibung(e.target.value)} />
      </Feld>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="w-4 h-4 accent-brand-blue" checked={personenschaden} onChange={e => setPersonenschaden(e.target.checked)} />
        {tx('Personenschaden', 'Personal injury')}
      </label>
      {personenschaden && (
        <input className={eingabeKlasse} value={personenschadenDetails} placeholder={tx('Art der Verletzung, betroffene Person', 'Type of injury, person affected')}
          onChange={e => setPersonenschadenDetails(e.target.value)} />
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="w-4 h-4 accent-brand-blue" checked={sachschaden} onChange={e => setSachschaden(e.target.checked)} />
        {tx('Sachschaden', 'Property damage')}
      </label>
      {sachschaden && (
        <input className={eingabeKlasse} value={sachschadenDetails} placeholder={tx('Beschädigte Sache', 'Damaged property')}
          onChange={e => setSachschadenDetails(e.target.value)} />
      )}

      <Feld label={tx('Zeugen (optional)', 'Witnesses (optional)')} htmlFor="vorfall-zeugen">
        <input id="vorfall-zeugen" className={eingabeKlasse} value={zeugen} onChange={e => setZeugen(e.target.value)} />
      </Feld>
      <Feld label={tx('Sofortmaßnahmen (optional)', 'Immediate actions (optional)')} htmlFor="vorfall-massnahmen">
        <input id="vorfall-massnahmen" className={eingabeKlasse} value={massnahmen} onChange={e => setMassnahmen(e.target.value)} />
      </Feld>

      {fehlt.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
          <p className="text-xs text-amber-800 font-medium">
            {tx('Für eine vollständige Meldung fehlt noch:', 'Still missing for a complete report:')} {fehlt.join(', ')}.
          </p>
        </div>
      )}

      <div>
        <p className={beschriftung}>{tx('Vorschau', 'Preview')}</p>
        <pre className="text-2xs leading-relaxed font-mono bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
          {bericht}
        </pre>
      </div>
    </Dialog>
  );
}
