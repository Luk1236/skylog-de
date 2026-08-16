import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, AlertTriangle, Activity, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { WeatherData } from '../services/weather';
import type { Drone, Battery, UserProfile } from '../services/db';
import { calculatePreFlightSafetyScore } from '../services/safetyScore';
import { fetchKpIndex, type KpData } from '../services/kpIndex';

interface Props {
  weather: WeatherData | null;
  drone: Drone | null;
  battery: Battery | null;
  profile: UserProfile | null;
  onClose: () => void;
}

export function PreFlightSafetyDialog({ weather, drone, battery, profile, onClose }: Props) {
  const [kpData, setKpData] = useState<KpData | null>(null);
  const [kpLoading, setKpLoading] = useState(true);

  useEffect(() => {
    setKpLoading(true);
    fetchKpIndex().then((data) => {
      setKpData(data);
      setKpLoading(false);
    });
  }, []);

  const kpIndex = kpData?.kpIndex ?? 2;
  const safety = calculatePreFlightSafetyScore(weather, drone, battery, profile, kpIndex);

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
    return 'text-red-500 border-red-500/30 bg-red-500/10';
  };

  const getBarColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-400';
    return 'bg-red-500';
  };

  const getStatusIcon = (status: 'pass' | 'warn' | 'fail') => {
    if (status === 'pass') return <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />;
    if (status === 'warn') return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
    return <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />;
  };

  const kpBarWidth = Math.min((kpIndex / 9) * 100, 100);
  const kpColor =
    kpIndex < 2 ? 'bg-emerald-500' :
    kpIndex < 4 ? 'bg-sky-400' :
    kpIndex < 5 ? 'bg-amber-400' :
    kpIndex < 7 ? 'bg-orange-500' : 'bg-red-600';

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[160] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-blue/20 text-brand-blue border border-brand-blue/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base">Pre-Flight Safety & Score</h2>
              <p className="text-xs text-slate-400">Vorflug-Sicherheitsanalyse & Live Kp-Index</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">

          {/* Score Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Flugsicherheits-Index</span>
                <h3 className="text-lg font-extrabold text-white leading-tight">
                  {safety.status === 'SAFE' && '🟢 Startfreigabe optimal'}
                  {safety.status === 'WARNING' && '🟡 Erhöhte Aufmerksamkeit'}
                  {safety.status === 'CRITICAL' && '🔴 Hohes Risiko – Start abgeraten'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Wetter · Wind · Solarsturm · Akku</p>
              </div>
              <div className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center font-black ${getScoreColor(safety.score)}`}>
                <span className="text-2xl leading-none">{safety.score}%</span>
                <span className="text-[9px] uppercase tracking-wider mt-1 opacity-80">Score</span>
              </div>
            </div>
            {/* Score progress bar */}
            <div className="w-full bg-slate-700/60 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${getBarColor(safety.score)}`}
                style={{ width: `${safety.score}%` }}
              />
            </div>
          </div>

          {/* Live Kp Solar Storm Widget */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <strong className="text-slate-200 block text-xs">Geomagnetischer Kp-Index (NOAA)</strong>
                  {kpLoading
                    ? <span className="text-[10px] text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Lade Echtzeit-Daten…</span>
                    : <span className={`text-[10px] font-medium ${kpData?.color ?? 'text-slate-400'}`}>{kpData?.label}</span>
                  }
                </div>
              </div>
              {!kpLoading && (
                <div className="flex items-center gap-1.5">
                  {kpData?.source === 'live'
                    ? <Wifi className="w-3 h-3 text-emerald-400" />
                    : <WifiOff className="w-3 h-3 text-slate-500" />}
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border
                    ${kpIndex < 4 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>
                    {kpIndex < 4 ? 'GPS Stabil' : 'GPS Warnung!'}
                  </span>
                </div>
              )}
            </div>
            {/* Kp bar */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 w-4 shrink-0">0</span>
              <div className="flex-1 bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-700 ${kpLoading ? 'bg-slate-600 animate-pulse w-1/4' : kpColor}`}
                  style={!kpLoading ? { width: `${kpBarWidth}%` } : {}}
                />
              </div>
              <span className="text-[9px] text-slate-500 w-4 shrink-0">9</span>
            </div>
            {kpData?.gpsWarning && (
              <p className="text-[10px] text-orange-400 mt-2 font-medium">
                ⚠️ Erhöhte geomagnetische Aktivität – GPS-Präzision eingeschränkt möglich. Kompasskalibrierung empfohlen.
              </p>
            )}
          </div>

          {/* Checklist Items */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px] px-1">Prüfpunkte der Vorflug-Analyse</h4>
            {safety.items.map((item) => (
              <div key={item.id} className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-3">
                {getStatusIcon(item.status)}
                <div className="flex-1">
                  <h5 className="font-bold text-slate-200 text-xs">{item.title}</h5>
                  <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* NOAA Attribution */}
          <p className="text-center text-[9px] text-slate-600">
            Kp-Daten: NOAA Space Weather Prediction Center (swpc.noaa.gov)
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
          <button
            onClick={onClose}
            className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-bold py-3 rounded-2xl text-xs transition-all active:scale-95 shadow-lg shadow-brand-blue/20"
          >
            Verstanden & Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
