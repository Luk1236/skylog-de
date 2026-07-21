import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { X, Clock, Plane, CalendarDays, TrendingUp, MapPin, AlertTriangle } from 'lucide-react';
import type { Flight, Drone } from '../services/db';
import { berechneStatistik, formatDauer } from '../services/flightStats';

interface Props {
  flights: Flight[];
  drones: Drone[];
  onClose: () => void;
}

function Kennzahl({ icon: Icon, wert, label }: { icon: any, wert: string, label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-1">
      <Icon className="w-4 h-4 text-brand-blue" />
      <span className="text-lg font-black text-slate-900 leading-none">{wert}</span>
      <span className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function StatisticsDialog({ flights, drones, onClose }: Props) {
  const s = useMemo(() => berechneStatistik(flights, drones), [flights, drones]);
  const maxMonatMin = Math.max(1, ...s.proMonat.map(m => m.minuten));

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-blue" />
            <h3 className="font-black text-slate-900">Statistik</h3>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {s.anzahlFluege === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">
              Noch keine Flüge — sobald du welche einträgst, erscheint hier deine Auswertung.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Kennzahl icon={Clock} wert={formatDauer(s.gesamtMinuten)} label="Flugzeit gesamt" />
                <Kennzahl icon={Plane} wert={String(s.anzahlFluege)} label="Flüge" />
                <Kennzahl icon={TrendingUp} wert={String(s.starts)} label="Starts" />
                <Kennzahl icon={CalendarDays} wert={String(s.aktiveTage)} label="Aktive Tage" />
                <Kennzahl icon={Clock} wert={formatDauer(s.schnittMinuten)} label="Ø Flugdauer" />
                <Kennzahl icon={Clock} wert={formatDauer(s.laengsterMinuten)} label="Längster Flug" />
              </div>

              <div className="bg-brand-blue text-white rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-blue-200">Dieses Jahr</p>
                  <p className="text-xl font-black">{formatDauer(s.diesesJahrMinuten)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-blue-200">Flüge {new Date().getFullYear()}</p>
                  <p className="text-xl font-black">{s.diesesJahrFluege}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Flüge pro Monat (12 Mon.)</p>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={s.proMonat} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 8 }} interval={1} />
                      <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={32} />
                      <Tooltip formatter={(v: any, n: any) => n === 'minuten' ? [formatDauer(v), 'Flugzeit'] : [v, 'Flüge']} />
                      <Bar dataKey="fluege" fill="#1e3a8a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Flugzeit je Drohne</p>
                <div className="space-y-2">
                  {s.proDrohne.map(d => {
                    const anteil = Math.round((d.minuten / Math.max(1, s.gesamtMinuten)) * 100);
                    return (
                      <div key={d.droneId}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-bold text-slate-700">{d.model}</span>
                          <span className="text-slate-400">{formatDauer(d.minuten)} · {d.fluege} Flüge</span>
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top-Standorte</p>
                  </div>
                  <div className="space-y-1.5">
                    {s.topOrte.map(o => (
                      <div key={o.ort} className="flex justify-between text-[11px]">
                        <span className="font-medium text-slate-700 truncate pr-2">{o.ort}</span>
                        <span className="text-slate-400 shrink-0">{o.anzahl}×</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-brand-red" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vorfälle</p>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{s.vorfallRateProzent}%</p>
                  <p className="text-[10px] text-slate-400">{s.vorfallAnzahl} von {s.anzahlFluege} Flügen</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
