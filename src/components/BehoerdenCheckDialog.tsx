import { useState, useMemo, useEffect } from 'react';
import { X, ShieldCheck, AlertTriangle, ChevronDown } from 'lucide-react';
import QRCode from 'qrcode';
import { cn } from '../lib/utils';
import type { UserProfile, Drone } from '../services/db';
import { baueBehoerdenCheck } from '../services/authorityCheck';

interface Props {
  profile: UserProfile | null;
  drohnen: Drone[];
  onClose: () => void;
}

// Vollbild-Ansicht für eine Polizei-/Behördenkontrolle: große, gut lesbare
// Nachweise plus QR-Code der Betreiberdaten. Gedacht zum Vorzeigen.
export function BehoerdenCheckDialog({ profile, drohnen, onClose }: Props) {
  const [drohnenId, setDrohnenId] = useState<string>(drohnen[0]?.id ?? '');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const drohne = useMemo(
    () => drohnen.find(d => d.id === drohnenId) ?? null,
    [drohnen, drohnenId]
  );

  const check = useMemo(
    () => baueBehoerdenCheck(profile, drohne),
    [profile, drohne]
  );

  // QR aus dem zusammengebauten Inhalt erzeugen. Fehler hier dürfen die
  // Ansicht nicht sprengen — dann bleibt eben nur die Textübersicht.
  useEffect(() => {
    let abgebrochen = false;
    QRCode.toDataURL(check.qrInhalt, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then(url => { if (!abgebrochen) setQrDataUrl(url); })
      .catch(() => { if (!abgebrochen) setQrDataUrl(''); });
    return () => { abgebrochen = true; };
  }, [check.qrInhalt]);

  return (
    <div className="fixed inset-0 bg-slate-900 z-[70] flex flex-col text-white overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-safe pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-green" />
          <span className="font-black text-sm uppercase tracking-widest">Behörden-Check</span>
        </div>
        <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl bg-white/10 active:scale-95">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 pb-10 max-w-md mx-auto w-full">
        <p className="text-[11px] text-slate-400 text-center mb-5">
          Diesen Bildschirm der kontrollierenden Person zeigen.
        </p>

        {check.warnungen.length > 0 && (
          <div className="mb-5 rounded-2xl bg-brand-red/15 border border-brand-red/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-brand-red" />
              <span className="text-xs font-black text-brand-red">Vor der Kontrolle prüfen</span>
            </div>
            <ul className="space-y-1">
              {check.warnungen.map((w, i) => (
                <li key={i} className="text-[11px] text-red-200 leading-relaxed">• {w}</li>
              ))}
            </ul>
          </div>
        )}

        {qrDataUrl && (
          <div className="flex justify-center mb-6">
            <div className="bg-white p-3 rounded-2xl">
              {/* Der QR kodiert dieselben Daten wie die Liste darunter. */}
              <img src={qrDataUrl} alt="QR-Code der Betreiberdaten" width={200} height={200} />
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10">
          {check.zeilen.map((z, i) => (
            <div key={i} className="flex items-start justify-between gap-4 px-4 py-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 shrink-0 pt-0.5">{z.label}</span>
              <span className={cn(
                'text-sm font-bold text-right break-words',
                z.problem ? 'text-brand-red' : 'text-white'
              )}>
                {z.wert}
              </span>
            </div>
          ))}
        </div>

        {drohnen.length > 1 && (
          <label className="mt-5 flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Drohne</span>
            <div className="relative flex-1">
              <select
                value={drohnenId}
                onChange={e => setDrohnenId(e.target.value)}
                className="w-full appearance-none bg-transparent text-sm font-bold text-white text-right pr-6 outline-none"
              >
                {drohnen.map(d => (
                  <option key={d.id} value={d.id} className="text-slate-900">
                    {d.name || d.model}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
