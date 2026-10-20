import { useSprache } from '../lib/sprache';
import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, Plus, TrendingDown, Gauge } from 'lucide-react';
import { dbService, type Battery, type BatteryReading } from '../services/db';
import {
  effektiveGesundheit, restZyklen, lebensdauerBewertung, gesundheitsProjektion,
} from '../services/batteryHealth';
import { Dialog, Knopf, Feld, eingabe, type DialogTon } from './ui';
import { cn } from '../lib/utils';

interface Props {
  battery: Battery;
  onClose: () => void;
  onUpdate: () => void;
}

/** Darstellung je Bewertungsstufe (Bedeutungsfarben laut DESIGN.md). */
const STUFE: Record<'austausch' | 'beobachten' | 'ok', { ton: DialogTon; text: string; flaeche: string; balken: string }> = {
  austausch: { ton: 'rot', text: 'text-brand-red', flaeche: 'bg-red-50 border-red-100', balken: 'bg-brand-red' },
  beobachten: { ton: 'bernstein', text: 'text-amber-800', flaeche: 'bg-amber-50 border-amber-100', balken: 'bg-amber-500' },
  ok: { ton: 'gruen', text: 'text-brand-green', flaeche: 'bg-emerald-50 border-emerald-100', balken: 'bg-brand-green' },
};

export function BatteryDetailDialog({ battery: initial, onClose, onUpdate }: Props) {
  const { tx } = useSprache();
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

  // Diagrammfarbe als Daten-Kodierung - über die Palette, damit sie den Dunkelmodus mitmacht.
  const farbe = bewertung.level === 'austausch' ? 'var(--color-brand-red)' : bewertung.level === 'beobachten' ? 'var(--color-amber-500)' : 'var(--color-brand-green)';
  const stufe = STUFE[bewertung.level === 'austausch' ? 'austausch' : bewertung.level === 'beobachten' ? 'beobachten' : 'ok'];

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
    <Dialog
      titel={<>{tx('Akku', 'Battery')} {battery.number}</>}
      icon={Zap}
      ton={stufe.ton}
      breite="md"
      onClose={onClose}
      fuss={erfassen ? (
        <>
          <Knopf variante="sekundaer" onClick={() => setErfassen(false)}>{tx('Abbrechen', 'Cancel')}</Knopf>
          <Knopf className="flex-1" onClick={messungSpeichern}>{tx('Speichern', 'Save')}</Knopf>
        </>
      ) : (
        <Knopf voll icon={Plus} onClick={() => setErfassen(true)}>{tx('Messung erfassen', 'Record reading')}</Knopf>
      )}
    >
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-1">
          <Gauge className={cn('w-4 h-4', stufe.text)} />
          <span className="text-lg font-black text-slate-900 leading-none">{soh}%</span>
          <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">SOH</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-1">
          <Zap className="w-4 h-4 text-brand-blue" />
          <span className="text-lg font-black text-slate-900 leading-none">{battery.cycles ?? 0}</span>
          <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{tx('Zyklen', 'Cycles')}</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-1">
          <TrendingDown className="w-4 h-4 text-slate-400" />
          <span className="text-lg font-black text-slate-900 leading-none">{rest}</span>
          <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{tx('Rest-Zyklen', 'Cycles left')}</span>
        </div>
      </div>

      {/* Zyklen-Fortschritt gegen die Hersteller-Grenze */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex justify-between text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          <span>{tx('Zyklen genutzt', 'Cycles used')}</span><span>{battery.cycles ?? 0} / {max}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', stufe.balken)} style={{ width: `${Math.min(100, ((battery.cycles ?? 0) / max) * 100)}%` }} />
        </div>
      </div>

      <div className={cn('rounded-2xl border p-4', stufe.flaeche)}>
        <p className={cn('text-xs font-bold', stufe.text)}>{bewertung.text}</p>
        {projektion.monateBisAustausch !== null && (
          <p className="text-xs text-slate-600 mt-1">{projektion.text}</p>
        )}
      </div>

      {chartDaten.length >= 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-2">{tx('Gesundheitsverlauf (%)', 'Health history (%)')}</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDaten} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                <XAxis dataKey="datum" tick={{ fontSize: 11 }} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Line type="monotone" dataKey="health" stroke={farbe} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {erfassen && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{tx('Neue Messung', 'New reading')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Feld label={tx('Zyklen', 'Cycles')} htmlFor="akku-messung-zyklen">
              <input id="akku-messung-zyklen" type="number" className={eingabe} value={zyklen} onChange={e => setZyklen(e.target.value)} />
            </Feld>
            <Feld label={tx('SOH % (optional)', 'SOH % (optional)')} htmlFor="akku-messung-soh">
              <input id="akku-messung-soh" type="number" className={eingabe} placeholder="z.B. 88" value={health} onChange={e => setHealth(e.target.value)} />
            </Feld>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500 text-center leading-relaxed">
        {tx('Zyklenzahl und SOH stehen in der DJI-Fly-App unter Akku-Info. Regelmäßig erfassen, damit der Verlauf und die Prognose aussagekräftig werden.', 'Cycle count and SOH are shown in the DJI Fly app under battery info. Record them regularly so the history and forecast are meaningful.')}
      </p>
    </Dialog>
  );
}
