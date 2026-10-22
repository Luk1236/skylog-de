import { useSprache } from '../lib/sprache';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, Plane, CalendarDays, TrendingUp, MapPin, AlertTriangle, type LucideIcon } from 'lucide-react';
import type { Flight, Drone } from '../services/db';
import { berechneStatistik, formatDauer } from '../services/flightStats';
import { Dialog, Abschnitt } from './ui';

interface Props {
  flights: Flight[];
  drones: Drone[];
  onClose: () => void;
}

function Kennzahl({ icon: Icon, wert, label }: { icon: LucideIcon, wert: string, label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-1">
      <Icon className="w-4 h-4 text-brand-blue" />
      <span className="text-lg font-black text-slate-900 leading-none">{wert}</span>
      <span className="text-xs font-bold text-slate-500">{label}</span>
    </div>
  );
}

export function StatisticsDialog({ flights, drones, onClose }: Props) {
  const { tx } = useSprache();
  const s = useMemo(() => berechneStatistik(flights, drones), [flights, drones]);

  return (
    <Dialog
      titel={tx('Statistik', 'Statistics')}
      icon={TrendingUp}
      breite="xxl"
      onClose={onClose}
    >
      {s.anzahlFluege === 0 ? (
        <p className="text-center text-sm text-slate-500 py-10">
          {tx('Noch keine Flüge — sobald du welche einträgst, erscheint hier deine Auswertung.', 'No flights yet — your statistics will appear here as soon as you log some.')}
        </p>
      ) : (
        // Am Laptop zweispaltig: Kennzahlen und Verlauf links, Drohnen, Orte und Vorfälle rechts
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Kennzahl icon={Clock} wert={formatDauer(s.gesamtMinuten)} label={tx('Flugzeit gesamt', 'Total flight time')} />
              <Kennzahl icon={Plane} wert={String(s.anzahlFluege)} label={tx('Flüge', 'Flights')} />
              <Kennzahl icon={TrendingUp} wert={String(s.starts)} label={tx('Starts', 'Take-offs')} />
              <Kennzahl icon={CalendarDays} wert={String(s.aktiveTage)} label={tx('Aktive Tage', 'Active days')} />
              <Kennzahl icon={Clock} wert={formatDauer(s.schnittMinuten)} label={tx('Ø Flugdauer', 'Avg. flight time')} />
              <Kennzahl icon={Clock} wert={formatDauer(s.laengsterMinuten)} label={tx('Längster Flug', 'Longest flight')} />
            </div>

            <div className="bg-brand-blue text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-white/80">{tx('Dieses Jahr', 'This year')}</p>
                <p className="text-xl font-black">{formatDauer(s.diesesJahrMinuten)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-white/80">{tx('Flüge', 'Flights')} {new Date().getFullYear()}</p>
                <p className="text-xl font-black">{s.diesesJahrFluege}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-3">
              <Abschnitt titel={tx('Flüge pro Monat (12 Mon.)', 'Flights per month (12 mo.)')} />
              <div className="h-32 lg:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.proMonat} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                    <Tooltip formatter={(v, n) => n === 'minuten' ? [formatDauer(Number(v)), tx('Flugzeit', 'Flight time')] : [v, tx('Flüge', 'Flights')]} />
                    <Bar dataKey="fluege" fill="#1e3a8a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <Abschnitt titel={tx('Flugzeit je Drohne', 'Flight time per drone')} className="mb-3" />
              <div className="space-y-2">
                {s.proDrohne.map(d => {
                  const anteil = Math.round((d.minuten / Math.max(1, s.gesamtMinuten)) * 100);
                  return (
                    <div key={d.droneId}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-slate-700">{d.model}</span>
                        <span className="text-slate-500">{formatDauer(d.minuten)} · {d.fluege} {tx('Flüge', 'Flights')}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-blue rounded-full" style={{ width: `${anteil}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-brand-blue" />
                  <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{tx('Top-Standorte', 'Top locations')}</p>
                </div>
                <div className="space-y-1.5">
                  {s.topOrte.map(o => (
                    <div key={o.ort} className="flex justify-between text-2xs">
                      <span className="font-medium text-slate-700 truncate pr-2">{o.ort}</span>
                      <span className="text-slate-500 shrink-0">{o.anzahl}×</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-brand-red" />
                  <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{tx('Vorfälle', 'Incidents')}</p>
                </div>
                <p className="text-2xl font-black text-slate-900">{s.vorfallRateProzent}%</p>
                <p className="text-2xs text-slate-500">{s.vorfallAnzahl} {tx('von', 'of')} {s.anzahlFluege} {tx('Flügen', 'flights')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
