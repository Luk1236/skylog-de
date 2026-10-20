import { useSprache } from '../lib/sprache';
import React, { useState } from 'react';
import { Layers, Plane, BatteryCharging, Wrench, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';
import type { Drone, Battery, UserProfile, MaintenanceRecord } from '../services/db';
import { Dialog, Knopf } from './ui';

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
    <Dialog
      titel={tx('Staffel- & Flottenmatrix', 'Squadron & fleet matrix')}
      untertitel={tx('Taktische Bereitschaftsübersicht für Teams, BOS & Flottenbetreiber', 'Tactical readiness overview for teams, emergency services & fleet operators')}
      icon={Layers}
      ton="bernstein"
      breite="xl"
      onClose={onClose}
    >
      {/* Operational Overview KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex items-center gap-2 text-brand-blue text-xs font-bold mb-1">
            <Plane className="w-4 h-4 shrink-0" />
            <span>{tx('Flottenstärke', 'Fleet size')}</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{drones.length} {tx('Drohnen', 'Drones')}</p>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex items-center gap-2 text-brand-green text-xs font-bold mb-1">
            <BatteryCharging className="w-4 h-4 shrink-0" />
            <span>{tx('Einsatzbereite Akkus', 'Ready batteries')}</span>
          </div>
          <p className="text-2xl font-black text-brand-green">{readyBatteries.length} / {batteries.length}</p>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-700 text-xs font-bold mb-1">
            <Wrench className="w-4 h-4 shrink-0" />
            <span>{tx('Flugstunden Gesamt', 'Total flight hours')}</span>
          </div>
          <p className="text-2xl font-black text-amber-700">{totalFlightHours.toFixed(1)} h</p>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex items-center gap-2 text-brand-blue text-xs font-bold mb-1">
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>{tx('Kommandant / Pilot', 'Commander / pilot')}</span>
          </div>
          <p className="text-sm font-bold text-slate-900 truncate mt-1">{profile?.name || 'Fernpilot'}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Knopf
          groesse="sm"
          variante={filter === 'all' ? 'primaer' : 'sekundaer'}
          aria-pressed={filter === 'all'}
          className="h-10"
          onClick={() => setFilter('all')}
        >
          {tx('Alle Drohnen (', 'All drones (')}{drones.length})
        </Knopf>
        <Knopf
          groesse="sm"
          variante={filter === 'ready' ? 'primaer' : 'sekundaer'}
          aria-pressed={filter === 'ready'}
          className="h-10"
          onClick={() => setFilter('ready')}
        >
          {tx('Einsatzbereit', 'Ready')}
        </Knopf>
        <Knopf
          groesse="sm"
          variante={filter === 'maintenance' ? 'primaer' : 'sekundaer'}
          aria-pressed={filter === 'maintenance'}
          className="h-10"
          onClick={() => setFilter('maintenance')}
        >
          {tx('Wartung erforderlich', 'Maintenance required')}
        </Knopf>
      </div>

      {/* Matrix Grid */}
      {filteredDrones.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-300 rounded-2xl text-slate-500">
          <Plane className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-xs font-bold">{tx('Keine Drohnen für diesen Filter gefunden', 'No drones match this filter')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredDrones.map(d => {
            const status = getDroneStatus(d.id);
            const droneMaint = maintenance.filter(m => m.droneId === d.id);

            return (
              <div
                key={d.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 relative overflow-hidden"
              >
                {/* Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900">{d.model}</h4>
                    <p className="text-xs text-slate-500">S/N: {d.serialNumber || 'Keine Seriennummer'}</p>
                  </div>

                  {status === 'ready' ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-brand-green text-2xs font-bold uppercase tracking-wider shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{tx('Einsatzbereit', 'Ready')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-2xs font-bold uppercase tracking-wider shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{tx('Wartung Offen', 'Maintenance open')}</span>
                    </div>
                  )}
                </div>

                {/* Specs */}
                <div className="grid grid-cols-3 gap-2 pt-3 text-xs border-t border-slate-100">
                  <div>
                    <span className="text-slate-500 block text-2xs uppercase font-bold tracking-wider">{tx('Gewicht', 'Weight')}</span>
                    <strong className="text-slate-900">{d.weight ? `${d.weight}g` : 'k.A.'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-2xs uppercase font-bold tracking-wider">{tx('UAS-Klasse', 'UAS class')}</span>
                    <strong className="text-slate-900">{d.uasClass || 'Legacy'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-2xs uppercase font-bold tracking-wider">{tx('Seriennummer', 'Serial number')}</span>
                    <strong className="text-slate-900">{d.serialNumber ? 'Ja' : 'Nein'}</strong>
                  </div>
                </div>

                {/* Maintenance Notes if any */}
                {droneMaint.length > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <strong>{tx('Wartung:', 'Maintenance:')}</strong> {droneMaint[0].description} ({droneMaint[0].date})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
