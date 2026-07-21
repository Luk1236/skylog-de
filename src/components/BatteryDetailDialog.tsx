import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { X, Zap, Plus, TrendingDown, Gauge } from 'lucide-react';
import { cn } from '../lib/utils';
import { dbService, type Battery, type BatteryReading } from '../services/db';
import {
  effektiveGesundheit, restZyklen, lebensdauerBewertung, gesundheitsProjektion,
} from '../services/batteryHealth';

interface Props {
  battery: Battery;
  onClose: () => void;
  onUpdate: () => void;
}

const feld = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm';

export function BatteryDetailDialog({ battery: initial, onClose, onUpdate }: Props) {
  const [battery, setBattery] = useState<Battery>(initial);
  const [zyklen, setZyklen] = useState<string>(String(initial.cycles ?? ''));
  const [health, setHealth] = useState<string>(initial.health ? String(initial.health) : '');
  const [erfassen, setErfassen] = useState(false);

  const bewertung = useMemo(() => lebensdauerBewertung(battery), [battery]);
  const projektion = useMemo(() => gesundheitsProjektion(battery.history), [battery]);
  const soh = effektiveGesundheit(battery);
  const rest = restZyklen(battery);
  const max = battery.maxCycles || 200;

  const chartDaten = useMemo(
    () => (battery.history ?? [])
      .filter(r => typeof r.health === 'number')
      .map(r => ({ datum: r.date.slice(5), health: r.health })),
    [battery]
  );

  const farbe = bewertung.level === 'austausch' ? '#b91c1c' : bewertung.level === 'beobachten' ? '#f59e0b' : '#059669';

  const messungSpeichern = async () => {
    const c = Number(zyklen);
    if (!Number.isFinite(c) || c < 0) return;
    const h = health.trim() ? Math.min(100, Math.max(0, Number(health))) : undefined;
    const reading: BatteryReading = { date: new Date().toISOString().slice(0, 10), cycles: c, health: h };
    // Am selben Tag ersetzen statt doppeln.
    const rest = (battery.history ?? []).filter(r => r.date !== reading.date);
    const aktualisiert: Battery = {
      ...battery,
      cycles: c,
      health: h ?? battery.health,
      history: [...rest, reading].sort((a, b) => (a.date < b.date ? -1 : 1)),
    };
    await dbService.saveBattery(aktualisiert);
    setBattery(aktualisiert);
    setErfassen(false);
    onUpdate();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 fill-current" style={{ color: farbe }} />
            <h3 className="font-black text-slate-900">Akku {battery.number}</h3>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-1">
              <Gauge className="w-4 h-4" style={{ color: farbe }} />
              <span className="text-lg font-black text-slate-900 leading-none">{soh}%</span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">SOH</span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-1">
              <Zap className="w-4 h-4 text-brand-blue" />
              <span className="text-lg font-black text-slate-900 leading-none">{battery.cycles ?? 0}</span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Zyklen</span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-1">
              <TrendingDown className="w-4 h-4 text-slate-400" />
              <span className="text-lg font-black text-slate-900 leading-none">{rest}</span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Rest-Zyklen</span>
            </div>
          </div>

          {/* Zyklen-Fortschritt gegen die Hersteller-Grenze */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              <span>Zyklen genutzt</span><span>{battery.cycles ?? 0} / {max}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((battery.cycles ?? 0) / max) * 100)}%`, background: farbe }} />
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ background: `${farbe}12`, border: `1px solid ${farbe}33` }}>
            <p className="text-xs font-bold" style={{ color: farbe }}>{bewertung.text}</p>
            {projektion.monateBisAustausch !== null && (
              <p className="text-[11px] text-slate-500 mt-1">{projektion.text}</p>
            )}
          </div>

          {chartDaten.length >= 2 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gesundheitsverlauf (%)</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDaten} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                    <XAxis dataKey="datum" tick={{ fontSize: 9 }} />
                    <YAxis domain={[50, 100]} tick={{ fontSize: 9 }} width={30} />
                    <Tooltip />
                    <Line type="monotone" dataKey="health" stroke={farbe} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {erfassen ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Neue Messung</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Zyklen</label>
                  <input type="number" className={feld} value={zyklen} onChange={e => setZyklen(e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">SOH % (optional)</label>
                  <input type="number" className={feld} placeholder="z.B. 88" value={health} onChange={e => setHealth(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={messungSpeichern} className="flex-1 bg-brand-blue text-white font-bold py-2.5 rounded-xl text-xs active:scale-95">Speichern</button>
                <button onClick={() => setErfassen(false)} className="px-4 text-xs font-bold text-slate-500">Abbrechen</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setErfassen(true)}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-sm active:scale-95">
              <Plus className="w-4 h-4" /> Messung erfassen
            </button>
          )}
          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Zyklenzahl und SOH stehen in der DJI-Fly-App unter Akku-Info. Regelmäßig
            erfassen, damit der Verlauf und die Prognose aussagekräftig werden.
          </p>
        </div>
      </div>
    </div>
  );
}
