import { useSprache } from '../lib/sprache';
import { useState } from 'react';
import { Scale, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Drone } from '../services/db';
import { Dialog, Feld, eingabe as eingabeKlasse, beschriftung } from './ui';
import { bewerteBetrieb, type RisikoEingabe, type Szenario, type Kategorie } from '../services/riskAssessment';

interface Props {
  drohnen: Drone[];
  onClose: () => void;
}


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
    <Dialog
      titel={tx('Risiko-Check', 'Risk check')}
      icon={Scale}
      breite="md"
      onClose={onClose}
    >
      {drohnen.length > 0 && (
        <Feld label={tx('Drohne', 'Drone')} htmlFor="risiko-drohne">
          <select id="risiko-drohne" className={eingabeKlasse} value={drohnenId} onChange={e => setDrohnenId(e.target.value)}>
            {drohnen.map(d => <option key={d.id} value={d.id}>{d.name || d.model} ({d.uasClass}, {d.weight} g)</option>)}
          </select>
        </Feld>
      )}

      <Feld label={tx('Umgebung / Unbeteiligte', 'Surroundings / uninvolved people')} htmlFor="risiko-szenario">
        <select id="risiko-szenario" className={eingabeKlasse} value={szenario} onChange={e => setSzenario(e.target.value as Szenario)}>
          <option value="keine_unbeteiligten">{tx('Keine Unbeteiligten im Bereich', 'No uninvolved people in the area')}</option>
          <option value="nahe_unbeteiligten">{tx('Unbeteiligte in der Nähe', 'Uninvolved people nearby')}</option>
          <option value="ueber_unbeteiligten">{tx('Überflug Unbeteiligter', 'Overflight of uninvolved people')}</option>
        </select>
      </Feld>

      <div className="grid grid-cols-2 gap-3">
        <Feld label={tx('Flughöhe (m)', 'Altitude (m)')} htmlFor="risiko-hoehe">
          <input id="risiko-hoehe" type="number" className={eingabeKlasse} value={hoehe} onChange={e => setHoehe(e.target.value)} />
        </Feld>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 self-end pb-2.5">
          <input type="checkbox" className="w-4 h-4 accent-brand-blue" checked={vlos} onChange={e => setVlos(e.target.checked)} /> {tx('In Sichtweite (VLOS)', 'Within line of sight (VLOS)')}
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="w-4 h-4 accent-brand-blue" checked={inBebautemGebiet} onChange={e => setInBebautemGebiet(e.target.checked)} />
        {tx('Wohn-/Gewerbe-/Industrie-/Erholungsgebiet', 'Residential / commercial / industrial / recreational area')}
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="w-4 h-4 accent-brand-blue" checked={menschenansammlung} onChange={e => setMenschenansammlung(e.target.checked)} />
        {tx('Flug über Menschenansammlung', 'Flight over an assembly of people')}
      </label>

      {/* Ergebnis */}
      <div className="rounded-2xl p-4 text-white" style={{ background: farbe }}>
        <p className="text-2xs font-bold uppercase tracking-wider opacity-80">{tx('Ermittelte Kategorie', 'Determined category')}</p>
        <p className="text-2xl font-black">{KAT_TEXT[ergebnis.kategorie]}</p>
        {!ergebnis.imOpen && <p className="text-xs mt-1 opacity-90">{tx('Außerhalb der Open-Kategorie — Genehmigung/STS nötig.', 'Outside the Open category — authorisation/STS required.')}</p>}
      </div>

      {ergebnis.gruende.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className={cn(beschriftung, 'flex items-center gap-1')}><ShieldAlert className="w-3 h-3 text-brand-red" /> {tx('Warum Specific', 'Why Specific')}</p>
          <ul className="space-y-1">
            {ergebnis.gruende.map((g, i) => <li key={i} className="text-xs text-slate-700 leading-relaxed">• {g}</li>)}
          </ul>
        </div>
      )}

      {ergebnis.verstoesse.length > 0 && (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
          <p className={cn(beschriftung, 'flex items-center gap-1 text-brand-red')}><AlertTriangle className="w-3 h-3" /> {tx('Verstöße beheben', 'Fix violations')}</p>
          <ul className="space-y-1">
            {ergebnis.verstoesse.map((v, i) => <li key={i} className="text-xs text-brand-red leading-relaxed">• {v}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className={cn(beschriftung, 'flex items-center gap-1')}><CheckCircle2 className="w-3 h-3 text-brand-green" /> {tx('Auflagen', 'Conditions')}</p>
        <ul className="space-y-1">
          {ergebnis.anforderungen.map((a, i) => <li key={i} className="text-xs text-slate-700 leading-relaxed">• {a}</li>)}
        </ul>
        <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100"><span className="font-bold">{tx('Kompetenz:', 'Competency:')}</span> {ergebnis.kompetenz}</p>
      </div>

      <p className="text-2xs text-slate-500 leading-relaxed">
        {tx('Orientierungshilfe nach EU 2019/947 — keine rechtsverbindliche Einstufung. Verbindlich sind die Angaben von LBA und dipul für den konkreten Ort.', 'Guidance based on EU 2019/947 — not a legally binding classification. The LBA and dipul information for the specific location is binding.')}
      </p>
    </Dialog>
  );
}
