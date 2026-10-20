import { useSprache } from '../lib/sprache';
import { useState } from 'react';
import { X, Scale, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Drone } from '../services/db';
import { bewerteBetrieb, type RisikoEingabe, type Szenario, type Kategorie } from '../services/riskAssessment';

interface Props {
  drohnen: Drone[];
  onClose: () => void;
}

const feld = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm';
const label = 'text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1 block';

// Ueber CSS-Variablen: im hellen Modus satte Toene (weisse Schrift ~5:1),
// im Dunkelmodus helle Toene (dort wird text-white dunkel), s. index.css.
const KAT_FARBE: Record<Kategorie, string> = {
  A1: 'var(--color-emerald-700)', A2: 'var(--color-amber-700)', A3: 'var(--color-amber-700)', Specific: 'var(--color-brand-red)',
};
const KAT_TEXT: Record<Kategorie, string> = {
  A1: 'Open A1', A2: 'Open A2', A3: 'Open A3', Specific: 'Specific',
};

export function RiskAssessmentDialog({ drohnen, onClose }: Props) {
  const { tx } = useSprache();
  const [drohnenId, setDrohnenId] = useState(drohnen[0]?.id ?? '');
  const [szenario, setSzenario] = useState<Szenario>('keine_unbeteiligten');
  const [menschenansammlung, setMenschenansammlung] = useState(false);
  const [inBebautemGebiet, setInBebautemGebiet] = useState(false);
  const [hoehe, setHoehe] = useState('100');
  const [vlos, setVlos] = useState(true);

  const drohne = drohnen.find(d => d.id === drohnenId);

  const eingabe: RisikoEingabe = {
    uasClass: drohne?.uasClass ?? 'Legacy',
    weight: drohne?.weight ?? 900,
    szenario, menschenansammlung, inBebautemGebiet,
    hoehe: Number(hoehe) || 0, vlos,
  };
  // Direkt berechnen: billig, und die alte useMemo-Liste vergass Aenderungen an der Drohnenliste.
  const ergebnis = bewerteBetrieb(eingabe);
  const farbe = KAT_FARBE[ergebnis.kategorie];

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand-blue" />
            <h3 className="font-black text-slate-900">{tx('Risiko-Check', 'Risk check')}</h3>
          </div>
          <button onClick={onClose} aria-label={tx('Schließen', 'Close')} className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {drohnen.length > 0 && (
            <div>
              <label className={label}>{tx('Drohne', 'Drone')}</label>
              <select className={feld} value={drohnenId} onChange={e => setDrohnenId(e.target.value)}>
                {drohnen.map(d => <option key={d.id} value={d.id}>{d.name || d.model} ({d.uasClass}, {d.weight} g)</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={label}>{tx('Umgebung / Unbeteiligte', 'Surroundings / uninvolved people')}</label>
            <select className={feld} value={szenario} onChange={e => setSzenario(e.target.value as Szenario)}>
              <option value="keine_unbeteiligten">{tx('Keine Unbeteiligten im Bereich', 'No uninvolved people in the area')}</option>
              <option value="nahe_unbeteiligten">{tx('Unbeteiligte in der Nähe', 'Uninvolved people nearby')}</option>
              <option value="ueber_unbeteiligten">{tx('Überflug Unbeteiligter', 'Overflight of uninvolved people')}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{tx('Flughöhe (m)', 'Altitude (m)')}</label>
              <input type="number" className={feld} value={hoehe} onChange={e => setHoehe(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 self-end pb-2.5">
              <input type="checkbox" checked={vlos} onChange={e => setVlos(e.target.checked)} /> {tx('In Sichtweite (VLOS)', 'Within line of sight (VLOS)')}
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={inBebautemGebiet} onChange={e => setInBebautemGebiet(e.target.checked)} />
            {tx('Wohn-/Gewerbe-/Industrie-/Erholungsgebiet', 'Residential / commercial / industrial / recreational area')}
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={menschenansammlung} onChange={e => setMenschenansammlung(e.target.checked)} />
            {tx('Flug über Menschenansammlung', 'Flight over an assembly of people')}
          </label>

          {/* Ergebnis */}
          <div className="rounded-2xl p-4 text-white" style={{ background: farbe }}>
            <p className="text-2xs uppercase tracking-wider opacity-80">{tx('Ermittelte Kategorie', 'Determined category')}</p>
            <p className="text-2xl font-black">{KAT_TEXT[ergebnis.kategorie]}</p>
            {!ergebnis.imOpen && <p className="text-xs mt-1 opacity-90">{tx('Außerhalb der Open-Kategorie — Genehmigung/STS nötig.', 'Outside the Open category — authorisation/STS required.')}</p>}
          </div>

          {ergebnis.gruende.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className={cn(label, 'flex items-center gap-1')}><ShieldAlert className="w-3 h-3 text-brand-red" /> {tx('Warum Specific', 'Why Specific')}</p>
              <ul className="space-y-1">
                {ergebnis.gruende.map((g, i) => <li key={i} className="text-2xs text-slate-600 leading-relaxed">• {g}</li>)}
              </ul>
            </div>
          )}

          {ergebnis.verstoesse.length > 0 && (
            <div className="bg-brand-red/5 rounded-2xl border border-brand-red/20 p-4">
              <p className={cn(label, 'flex items-center gap-1 text-brand-red')}><AlertTriangle className="w-3 h-3" /> {tx('Verstöße beheben', 'Fix violations')}</p>
              <ul className="space-y-1">
                {ergebnis.verstoesse.map((v, i) => <li key={i} className="text-2xs text-brand-red leading-relaxed">• {v}</li>)}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className={cn(label, 'flex items-center gap-1')}><CheckCircle2 className="w-3 h-3 text-brand-green" /> {tx('Auflagen', 'Conditions')}</p>
            <ul className="space-y-1">
              {ergebnis.anforderungen.map((a, i) => <li key={i} className="text-2xs text-slate-600 leading-relaxed">• {a}</li>)}
            </ul>
            <p className="text-2xs text-slate-500 mt-2 pt-2 border-t border-slate-100"><span className="font-bold">{tx('Kompetenz:', 'Competency:')}</span> {ergebnis.kompetenz}</p>
          </div>

          <p className="text-2xs text-slate-400 leading-relaxed">
            {tx('Orientierungshilfe nach EU 2019/947 — keine rechtsverbindliche Einstufung. Verbindlich sind die Angaben von LBA und dipul für den konkreten Ort.', 'Guidance based on EU 2019/947 — not a legally binding classification. The LBA and dipul information for the specific location is binding.')}
          </p>
        </div>
      </div>
    </div>
  );
}
