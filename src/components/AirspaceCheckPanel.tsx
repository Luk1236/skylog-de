import { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  holeZonen, bewerteZonen, formatGrenzen, betrifftHoehe, type Zone,
} from '../services/airspaceZones';

interface Props {
  lat: number;
  lon: number;
  /** Geplante Flughöhe in Metern über Grund — blendet Zonen aus, die erst
   *  darüber beginnen oder darunter enden. */
  planHoeheM?: number;
}

const STUFE_FARBE: Record<string, string> = {
  frei: '#059669',
  hinweis: '#f59e0b',
  kritisch: '#b91c1c',
};

// Fragt die amtlichen Geo-Zonen (dipul/DFS) am Standort ab und fasst sie zu
// einem Urteil zusammen — mit Höhengrenzen und Rechtsgrundlage je Zone.
export function AirspaceCheckPanel({ lat, lon, planHoeheM }: Props) {
  const [zonen, setZonen] = useState<Zone[] | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      setZonen(await holeZonen(lat, lon));
    } catch {
      setFehler('Zonendaten nicht erreichbar.');
      setZonen(null);
    } finally {
      setLaeuft(false);
    }
  };

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lon)) laden();
  }, [lat, lon]);

  // Wenn eine Flughöhe bekannt ist, nur die vertikal betroffenen Zonen zeigen.
  const relevant = (zonen ?? []).filter(
    z => planHoeheM === undefined || betrifftHoehe(z, planHoeheM)
  );
  const urteil = bewerteZonen(relevant);
  const farbe = STUFE_FARBE[urteil.stufe];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-brand-blue" />
          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Luftraum am Standort</span>
        </div>
        <button onClick={laden} aria-label="Zonen neu laden" disabled={laeuft}
          className="p-1 text-slate-300 hover:text-brand-blue disabled:opacity-40">
          <RefreshCw className={cn('w-4 h-4', laeuft && 'animate-spin')} />
        </button>
      </div>

      {fehler && (
        <p className="text-[11px] text-brand-red flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {fehler}
        </p>
      )}

      {!fehler && zonen !== null && (
        <>
          <div className="rounded-xl p-3 mb-3 flex items-start gap-2"
            style={{ background: `${farbe}12`, border: `1px solid ${farbe}33` }}>
            {urteil.stufe === 'frei'
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: farbe }} />
              : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: farbe }} />}
            <p className="text-[11px] font-medium leading-snug" style={{ color: farbe }}>
              {urteil.text}
            </p>
          </div>

          {relevant.length > 0 && (
            <div className="space-y-2">
              {relevant.map((z, i) => (
                <div key={`${z.layer}-${i}`} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-900 leading-tight">{z.name}</span>
                    <span className={cn(
                      'text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0',
                      z.stufe === 'kritisch' ? 'bg-brand-red/10 text-brand-red' : 'bg-amber-50 text-amber-600'
                    )}>
                      {z.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Höhe: {formatGrenzen(z)}</p>
                  {z.rechtsgrundlage && (
                    <p className="text-[9px] text-slate-400 mt-0.5">{z.rechtsgrundlage}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <a href="https://maptool-dipul.dfs.de/" target="_blank" rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1 text-[10px] font-bold text-brand-blue">
            <ExternalLink className="w-3 h-3" /> Amtliche Karte (dipul) öffnen
          </a>
          <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">
            Abfrage im Umkreis von 500 m um deinen Standort. Orientierungshilfe —
            verbindlich ist die amtliche dipul-Karte.
          </p>
        </>
      )}
    </div>
  );
}
