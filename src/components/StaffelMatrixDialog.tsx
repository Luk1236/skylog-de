import { useSprache } from '../lib/sprache';
import React, { useState } from 'react';
import { X, Layers, Plane, BatteryCharging, Wrench, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';
import type { Drone, Battery, UserProfile, MaintenanceRecord } from '../services/db';

interface Props {
  drones: Drone[];
  batteries: Battery[];
  maintenance: MaintenanceRecord[];
  profile: UserProfile | null;
  onClose: () => void;
}

export function StaffelMatrixDialog({ drones, batteries, maintenance, profile, onClose }: Props) {
  const { tx } = useSprache();
  const [filter, setFilter] = useState<'all' | 'ready' | 'maintenance'>('all');

  const readyBatteries = batteries.filter(b => (b.health || 100) >= 80);
  const totalFlightHours = 0;

  const getDroneStatus = (droneId: string) => {
    const droneMaint = maintenance.filter(m => m.droneId === droneId);
    const hasUrgent = droneMaint.length > 0;
    return hasUrgent ? 'maintenance' : 'ready';
  };

  const filteredDrones = drones.filter(d => {
    const status = getDroneStatus(d.id);
    if (filter === 'ready') return status === 'ready';
    if (filter === 'maintenance') return status === 'maintenance';
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto">
      <div className="immer-dunkel bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">{tx('Staffel- & Flottenmatrix (Multi-Drone Operational View)', 'Squadron & fleet matrix (multi-drone operational view)')}</h2>
              <p className="text-xs text-slate-400">{tx('Taktische Bereitschaftsübersicht für Teams, BOS & Flottenbetreiber', 'Tactical readiness overview for teams, emergency services & fleet operators')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operational Overview KPI Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-2">
          <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold mb-1">
              <Plane className="w-4 h-4" />
              <span>{tx('Flottenstärke', 'Fleet size')}</span>
            </div>
            <p className="text-2xl font-black text-white">{drones.length} {tx('Drohnen', 'Drones')}</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
              <BatteryCharging className="w-4 h-4" />
              <span>{tx('Einsatzbereite Akkus', 'Ready batteries')}</span>
            </div>
            <p className="text-2xl font-black text-emerald-400">{readyBatteries.length} / {batteries.length}</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
              <Wrench className="w-4 h-4" />
              <span>{tx('Flugstunden Gesamt', 'Total flight hours')}</span>
            </div>
            <p className="text-2xl font-black text-amber-400">{totalFlightHours.toFixed(1)} h</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold mb-1">
              <UserCheck className="w-4 h-4" />
              <span>{tx('Kommandant / Pilot', 'Commander / pilot')}</span>
            </div>
            <p className="text-sm font-bold text-slate-200 truncate mt-1">{profile?.name || 'Fernpilot'}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 pt-3 flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {tx('Alle Drohnen (', 'All drones (')}{drones.length})
          </button>
          <button
            onClick={() => setFilter('ready')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'ready' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {tx('Einsatzbereit', 'Ready')}
          </button>
          <button
            onClick={() => setFilter('maintenance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'maintenance' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {tx('Wartung erforderlich', 'Maintenance required')}
          </button>
        </div>

        {/* Matrix Grid */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {filteredDrones.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl text-slate-500">
              <Plane className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">{tx('Keine Drohnen für diesen Filter gefunden', 'No drones match this filter')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDrones.map(d => {
                const status = getDroneStatus(d.id);
                const droneMaint = maintenance.filter(m => m.droneId === d.id);

                return (
                  <div
                    key={d.id}
                    className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3 relative overflow-hidden"
                  >
                    {/* Status Badge */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-black text-base text-white">{d.model}</h4>
                        <p className="text-2xs text-slate-400">S/N: {d.serialNumber || 'Keine Seriennummer'}</p>
                      </div>

                      {status === 'ready' ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-2xs font-black uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{tx('Einsatzbereit', 'Ready')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-2xs font-black uppercase tracking-wider">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{tx('Wartung Offen', 'Maintenance open')}</span>
                        </div>
                      )}
                    </div>

                    {/* Specs */}
                    <div className="grid grid-cols-3 gap-2 pt-2 text-2xs border-t border-slate-700/60">
                      <div>
                        <span className="text-slate-400 block text-2xs uppercase font-bold">{tx('Gewicht', 'Weight')}</span>
                        <strong className="text-slate-200">{d.weight ? `${d.weight}g` : 'k.A.'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-2xs uppercase font-bold">{tx('UAS-Klasse', 'UAS class')}</span>
                        <strong className="text-slate-200">{d.uasClass || 'Legacy'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-2xs uppercase font-bold">{tx('Seriennummer', 'Serial number')}</span>
                        <strong className="text-slate-200">{d.serialNumber ? 'Ja' : 'Nein'}</strong>
                      </div>
                    </div>

                    {/* Maintenance Notes if any */}
                    {droneMaint.length > 0 && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-2xs text-amber-300">
                        <strong>{tx('Wartung:', 'Maintenance:')}</strong> {droneMaint[0].description} ({droneMaint[0].date})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
