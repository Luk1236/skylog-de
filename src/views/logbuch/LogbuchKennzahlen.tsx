import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { BarChart3, Calendar } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import type { Drone, Flight } from '../../services/db';

/** Kennzahlen, letzte 7 Tage, Zwecke und Jahresübersicht - immer über alle Flüge. */
export function LogbuchKennzahlen({ fluege, drones, zweckLabel }: {
  /** Gültige Flüge (nicht in der Zukunft), neueste zuerst. */
  fluege: Flight[];
  drones: Drone[];
  zweckLabel: (p?: Flight['purpose']) => string;
}) {
  const { tx, sprache } = useSprache();

  const minutenGesamt = fluege.reduce((summe, f) => summe + (f.duration || 0), 0);
  const anzahl = fluege.length;
  const schnitt = anzahl > 0 ? Math.round(minutenGesamt / anzahl) : 0;

  const dieserMonat = new Date().toISOString().slice(0, 7);
  const fluegeDiesenMonat = fluege.filter(f => f.date.startsWith(dieserMonat)).length;

  const topDrohne = drones
    .map(d => ({ model: d.model, count: fluege.filter(f => f.droneId === d.id).length }))
    .sort((a, b) => b.count - a.count)[0];

  const proZweck: Record<string, number> = {};
  for (const f of fluege) {
    const zweck = f.purpose || 'Hobby';
    proZweck[zweck] = (proZweck[zweck] || 0) + 1;
  }
  const zweckDaten = Object.entries(proZweck).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Letzte 7 Tage für das Diagramm
  const tage = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();
  const diagramm = tage.map(datum => ({
    date: datum.split('-').slice(1).reverse().join('.'),
    flights: fluege.filter(f => f.date === datum).length,
  }));

  const jahr = new Date().getFullYear();
  // Monatskürzel in der eingestellten Sprache (de: Mär, Okt … / en: Mar, Oct …)
  const monate = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(sprache === 'en' ? 'en-GB' : 'de-DE', { month: 'short' }).replace('.', ''));
  const jahresDaten = monate.map((label, i) => {
    const praefix = `${jahr}-${String(i + 1).padStart(2, '0')}`;
    const imMonat = fluege.filter(f => f.date.startsWith(praefix));
    return { label, flights: imMonat.length, minutes: imMonat.reduce((a, f) => a + (f.duration || 0), 0) };
  });
  const jahresMinuten = jahresDaten.reduce((a, m) => a + m.minutes, 0);
  const maxMinuten = Math.max(...jahresDaten.map(m => m.minutes), 1);

  return (
    <>
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: tx('Gesamt', 'Total'), wert: `${Math.floor(minutenGesamt / 60)} h ${minutenGesamt % 60} min`, akzent: true },
            { label: tx('Flüge', 'Flights'), wert: String(anzahl), akzent: false },
            { label: tx('Schnitt', 'Average'), wert: `${schnitt} min`, akzent: false },
          ].map(k => (
            <div key={k.label} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 mb-1">{k.label}</p>
              <p className={cn('text-base font-black whitespace-nowrap', k.akzent ? 'text-brand-blue' : 'text-slate-900')}>{k.wert}</p>
            </div>
          ))}
        </div>

        {/* Letzte 7 Tage */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-brand-blue" />
            <h3 className="text-sm font-bold text-slate-900">{tx('Letzte 7 Tage', 'Last 7 days')}</h3>
          </div>
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diagramm}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-slate-200)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-slate-500)', fontWeight: 600 }} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const n = Number(payload[0].value);
                      return (
                        <div className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-xl">
                          {n} {n === 1 ? tx('Flug', 'flight') : tx('Flüge', 'flights')}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="flights" radius={[4, 4, 0, 0]} barSize={16}>
                  {diagramm.map((eintrag, index) => (
                    <Cell key={`cell-${index}`} fill={eintrag.flights > 0 ? 'var(--color-brand-blue)' : 'var(--color-slate-100)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Erweiterte Statistiken */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 mb-1">{tx('Diesen Monat', 'This month')}</p>
          <p className="text-lg font-black text-slate-900">{fluegeDiesenMonat} <span className="text-sm font-bold text-slate-500">{tx('Flüge', 'Flights')}</span></p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 mb-1">{tx('Top-Drohne', 'Top drone')}</p>
          <p className="text-sm font-black text-slate-900 truncate">{topDrohne?.model || '—'}</p>
          {topDrohne && <p className="text-xs text-slate-500">{topDrohne.count} {tx('Flüge', 'Flights')}</p>}
        </div>
      </div>
      {zweckDaten.length > 0 && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm mb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3">{tx('Flüge nach Zweck', 'Flights by purpose')}</h3>
          <div className="space-y-2">
            {zweckDaten.map(({ name, value }) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 w-24 shrink-0">{zweckLabel(name as Flight['purpose'])}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div className="bg-brand-blue h-1.5 rounded-full" style={{ width: `${Math.round((value / anzahl) * 100)}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-500 w-6 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jahresübersicht */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-blue" />
            <h3 className="text-sm font-bold text-slate-900">{tx('Jahresübersicht', 'Year overview')} {jahr}</h3>
          </div>
          <span className="text-xs font-bold text-brand-blue whitespace-nowrap">{Math.floor(jahresMinuten / 60)} h {jahresMinuten % 60} min</span>
        </div>
        <div className="flex items-end gap-1 h-16">
          {jahresDaten.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className={cn('w-full rounded-t-sm transition-all', m.minutes > 0 ? 'bg-brand-blue' : 'bg-slate-100')}
                style={{ height: `${Math.max(2, Math.round((m.minutes / maxMinuten) * 48))}px` }}
              />
              <span className="text-2xs font-bold text-slate-500">{m.label}</span>
              {m.flights > 0 && <span className="text-2xs font-bold text-brand-blue">{m.flights}</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
