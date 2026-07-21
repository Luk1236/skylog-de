import { useState, useMemo } from 'react';
import { X, Scale, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Drone } from '../services/db';
import { bewerteBetrieb, type RisikoEingabe, type Szenario, type Kategorie } from '../services/riskAssessment';

interface Props {
  drohnen: Drone[];
  onClose: () => void;
}

const feld = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm';
const label = 'text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block';

const KAT_FARBE: Record<Kategorie, string> = {
  A1: '#059669', A2: '#f59e0b', A3: '#f59e0b', Specific: '#b91c1c',
};
const KAT_TEXT: Record<Kategorie, string> = {
  A1: 'Open A1', A2: 'Open A2', A3: 'Open A3', Specific: 'Specific',
};

export function RiskAssessmentDialog({ drohnen, onClose }: Props) {
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
  const ergebnis = useMemo(() => bewerteBetrieb(eingabe), [drohnenId, szenario, menschenansammlung, inBebautemGebiet, hoehe, vlos]);
  const farbe = KAT_FARBE[ergebnis.kategorie];

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand-blue" />
            <h3 className="font-black text-slate-900">Risiko-Check</h3>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {drohnen.length > 0 && (
            <div>
              <label className={label}>Drohne</label>
              <select className={feld} value={drohnenId} onChange={e => setDrohnenId(e.target.value)}>
                {drohnen.map(d => <option key={d.id} value={d.id}>{d.name || d.model} ({d.uasClass}, {d.weight} g)</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={label}>Umgebung / Unbeteiligte</label>
            <select className={feld} value={szenario} onChange={e => setSzenario(e.target.value as Szenario)}>
              <option value="keine_unbeteiligten">Keine Unbeteiligten im Bereich</option>
              <option value="nahe_unbeteiligten">Unbeteiligte in der Nähe</option>
              <option value="ueber_unbeteiligten">Überflug Unbeteiligter</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Flughöhe (m)</label>
              <input type="number" className={feld} value={hoehe} onChange={e => setHoehe(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 self-end pb-2.5">
              <input type="checkbox" checked={vlos} onChange={e => setVlos(e.target.checked)} /> In Sichtweite (VLOS)
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={inBebautemGebiet} onChange={e => setInBebautemGebiet(e.target.checked)} />
            Wohn-/Gewerbe-/Industrie-/Erholungsgebiet
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={menschenansammlung} onChange={e => setMenschenansammlung(e.target.checked)} />
            Flug über Menschenansammlung
          </label>

          {/* Ergebnis */}
          <div className="rounded-2xl p-4 text-white" style={{ background: farbe }}>
            <p className="text-[10px] uppercase tracking-widest opacity-80">Ermittelte Kategorie</p>
            <p className="text-2xl font-black">{KAT_TEXT[ergebnis.kategorie]}</p>
            {!ergebnis.imOpen && <p className="text-xs mt-1 opacity-90">Außerhalb der Open-Kategorie — Genehmigung/STS nötig.</p>}
          </div>

          {ergebnis.gruende.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className={cn(label, 'flex items-center gap-1')}><ShieldAlert className="w-3 h-3 text-brand-red" /> Warum Specific</p>
              <ul className="space-y-1">
                {ergebnis.gruende.map((g, i) => <li key={i} className="text-[11px] text-slate-600 leading-relaxed">• {g}</li>)}
              </ul>
            </div>
          )}

          {ergebnis.verstoesse.length > 0 && (
            <div className="bg-brand-red/5 rounded-2xl border border-brand-red/20 p-4">
              <p className={cn(label, 'flex items-center gap-1 text-brand-red')}><AlertTriangle className="w-3 h-3" /> Verstöße beheben</p>
              <ul className="space-y-1">
                {ergebnis.verstoesse.map((v, i) => <li key={i} className="text-[11px] text-brand-red leading-relaxed">• {v}</li>)}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className={cn(label, 'flex items-center gap-1')}><CheckCircle2 className="w-3 h-3 text-brand-green" /> Auflagen</p>
            <ul className="space-y-1">
              {ergebnis.anforderungen.map((a, i) => <li key={i} className="text-[11px] text-slate-600 leading-relaxed">• {a}</li>)}
            </ul>
            <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100"><span className="font-bold">Kompetenz:</span> {ergebnis.kompetenz}</p>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Orientierungshilfe nach EU 2019/947 — keine rechtsverbindliche Einstufung.
            Verbindlich sind die Angaben von LBA und dipul für den konkreten Ort.
          </p>
        </div>
      </div>
    </div>
  );
}
