import { useSprache } from '../lib/sprache';
import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Activity, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { WeatherData } from '../services/weather';
import type { Drone, Battery, UserProfile } from '../services/db';
import { calculatePreFlightSafetyScore } from '../services/safetyScore';
import { fetchKpIndex, type KpData } from '../services/kpIndex';
import { Dialog, Knopf } from './ui';

/** Textfarbe der Kp-Bewertung im hellen Design. Der Dienst liefert in `color`
 *  noch Töne für dunkle Flächen (sky-400 …), daher hier nach Status abgeleitet. */
const KP_TEXT: Record<KpData['status'], string> = {
  quiet: 'text-brand-green',
  unsettled: 'text-brand-blue',
  active: 'text-amber-700',
  minor_storm: 'text-brand-orange',
  major_storm: 'text-brand-red',
};

interface Props {
  weather: WeatherData | null;
  drone: Drone | null;
  battery: Battery | null;
  profile: UserProfile | null;
  onClose: () => void;
}

export function PreFlightSafetyDialog({ weather, drone, battery, profile, onClose }: Props) {
  const { tx } = useSprache();
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
    if (score >= 85) return 'text-brand-green border-emerald-200 bg-emerald-50';
    if (score >= 60) return 'text-amber-800 border-amber-200 bg-amber-50';
    return 'text-brand-red border-red-200 bg-red-50';
  };

  const getBarColor = (score: number) => {
    if (score >= 85) return 'bg-brand-green';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-brand-red';
  };

  const getStatusIcon = (status: 'pass' | 'warn' | 'fail') => {
    if (status === 'pass') return <ShieldCheck className="w-5 h-5 text-brand-green shrink-0" />;
    if (status === 'warn') return <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />;
    return <AlertTriangle className="w-5 h-5 text-brand-red shrink-0" />;
  };

  const kpBarWidth = Math.min((kpIndex / 9) * 100, 100);
  const kpColor =
    kpIndex < 2 ? 'bg-brand-green' :
    kpIndex < 4 ? 'bg-brand-blue' :
    kpIndex < 5 ? 'bg-amber-500' :
    kpIndex < 7 ? 'bg-brand-orange' : 'bg-brand-red';

  return (
    <Dialog
      titel={tx('Vorflug-Check & Sicherheitswert', 'Pre-flight check & score')}
      untertitel={tx('Wetter, Wind und aktueller Kp-Index', 'Pre-flight safety analysis & live Kp index')}
      icon={ShieldCheck}
      ton="blau"
      breite="lg"
      onClose={onClose}
      fuss={
        <Knopf voll onClick={onClose}>
          {tx('Verstanden & Schließen', 'Got it & close')}
        </Knopf>
      }
    >
      {/* Score Card */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{tx('Flugsicherheits-Index', 'Flight safety index')}</span>
            <h3 className="text-lg font-black text-slate-900 leading-tight">
              {safety.status === 'SAFE' && tx('Gute Bedingungen', 'Good conditions')}
              {safety.status === 'WARNING' && tx('Erhöhte Aufmerksamkeit', 'Extra caution')}
              {safety.status === 'CRITICAL' && tx('Hohes Risiko – vom Start abgeraten', 'High risk – take-off not advised')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{tx('Wetter · Wind · Solarsturm · Akku', 'Weather · wind · solar storm · battery')}</p>
          </div>
          <div className={`w-20 h-20 shrink-0 rounded-2xl border-2 flex flex-col items-center justify-center font-black ${getScoreColor(safety.score)}`}>
            <span className="text-2xl leading-none">{safety.score}%</span>
            <span className="text-2xs mt-1">{tx('Sicherheit', 'Safety')}</span>
          </div>
        </div>
        {/* Score progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${getBarColor(safety.score)}`}
            style={{ width: `${safety.score}%` }}
          />
        </div>
      </div>

      {/* Live Kp Solar Storm Widget */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-brand-blue shrink-0" />
            <div>
              <strong className="text-slate-900 block text-sm font-bold">{tx('Geomagnetischer Kp-Index (NOAA)', 'Geomagnetic Kp index (NOAA)')}</strong>
              {kpLoading
                ? <span className="text-xs text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {tx('Lade Echtzeit-Daten…', 'Loading live data…')}</span>
                : <span className={`text-xs font-bold ${kpData ? KP_TEXT[kpData.status] : 'text-slate-500'}`}>{kpData?.label}</span>
              }
            </div>
          </div>
          {!kpLoading && (
            <div className="flex items-center gap-1.5 shrink-0">
              {kpData?.source === 'live'
                ? <Wifi className="w-3.5 h-3.5 text-brand-green" />
                : <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
              <span className={`px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-wider border
                ${kpIndex < 4 ? 'bg-emerald-50 text-brand-green border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                {kpIndex < 4 ? 'GPS Stabil' : 'GPS Warnung!'}
              </span>
            </div>
          )}
        </div>
        {/* Kp bar */}
        <div className="flex items-center gap-2">
          <span className="text-2xs text-slate-500 w-4 shrink-0">0</span>
          <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-700 ${kpLoading ? 'bg-slate-300 animate-pulse w-1/4' : kpColor}`}
              style={!kpLoading ? { width: `${kpBarWidth}%` } : {}}
            />
          </div>
          <span className="text-2xs text-slate-500 w-4 shrink-0">9</span>
        </div>
        {kpData?.gpsWarning && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3 font-medium">
            {tx('⚠️ Erhöhte geomagnetische Aktivität – GPS-Präzision eingeschränkt möglich. Kompasskalibrierung empfohlen.', '⚠️ Increased geomagnetic activity – GPS accuracy may be reduced. Compass calibration recommended.')}
          </p>
        )}
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        <h4 className="font-bold text-slate-500 uppercase tracking-wider text-2xs px-1">{tx('Prüfpunkte der Vorflug-Analyse', 'Pre-flight analysis check items')}</h4>
        {safety.items.map((item) => (
          <div key={item.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            {getStatusIcon(item.status)}
            <div className="flex-1">
              <h5 className="font-bold text-slate-900 text-sm">{item.title}</h5>
              <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* NOAA Attribution */}
      <p className="text-center text-2xs text-slate-500">
        {tx('Kp-Daten: NOAA Space Weather Prediction Center (swpc.noaa.gov)', 'Kp data: NOAA Space Weather Prediction Center (swpc.noaa.gov)')}
      </p>
    </Dialog>
  );
}
