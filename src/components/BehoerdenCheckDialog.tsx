import { useSprache } from '../lib/sprache';
import { useState, useMemo, useEffect, useId } from 'react';
import { X, ShieldCheck, AlertTriangle, ChevronDown, FileDigit, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import { cn } from '../lib/utils';
import type { UserProfile, Drone, AppDocument } from '../services/db';
import { baueBehoerdenCheck } from '../services/authorityCheck';
import { useEbene } from '../lib/useEbene';

interface Props {
  profile: UserProfile | null;
  drohnen: Drone[];
  /** Im Profil gespeicherte PDFs (Versicherungsschein, Nachweis) - offline vorzeigbar. */
  dokumente?: AppDocument[];
  onClose: () => void;
}

// Vollbild-Ansicht für eine Polizei-/Behördenkontrolle: große, gut lesbare
// Nachweise plus QR-Code der Betreiberdaten. Gedacht zum Vorzeigen.
// Bewusst kein `Dialog` (Vollbild statt Popup), aber hell nach DESIGN.md.
export function BehoerdenCheckDialog({ profile, drohnen, dokumente = [], onClose }: Props) {
  const { tx } = useSprache();
  useEbene(true, onClose);
  const titelId = useId();
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
    <div role="dialog" aria-modal="true" aria-labelledby={titelId} className="fixed inset-0 bg-slate-50 z-[60] flex flex-col text-slate-900 overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-safe pb-3 shrink-0 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-green" />
          <h2 id={titelId} className="font-black text-base text-slate-900">{tx('Behörden-Check', 'Authority check')}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label={tx('Schließen', 'Close')}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 pt-5 pb-10 max-w-md mx-auto w-full">
        <p className="text-xs text-slate-500 text-center mb-5">
          {tx('Diesen Bildschirm der kontrollierenden Person zeigen.', 'Show this screen to the inspecting officer.')}
        </p>

        {check.warnungen.length > 0 && (
          <div className="mb-5 rounded-3xl bg-red-50 border border-red-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-brand-red shrink-0" />
              <span className="text-sm font-bold text-brand-red">{tx('Vor der Kontrolle prüfen', 'Check before the inspection')}</span>
            </div>
            <ul className="space-y-1">
              {check.warnungen.map((w, i) => (
                <li key={i} className="text-xs text-brand-red leading-relaxed">• {w}</li>
              ))}
            </ul>
          </div>
        )}

        {qrDataUrl && (
          <div className="flex justify-center mb-6">
            {/* Fester weißer Grund (auch im Dunkelmodus), damit der QR scanbar bleibt.
                Inline statt bg-white, weil bg-white im Dunkelmodus umgefärbt wird. */}
            <div className="p-3 rounded-2xl border border-slate-200 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
              {/* Der QR kodiert dieselben Daten wie die Liste darunter. */}
              <img src={qrDataUrl} alt={tx('QR-Code der Betreiberdaten', 'QR code of the operator data')} width={200} height={200} />
            </div>
          </div>
        )}

        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-200">
          {check.zeilen.map((z, i) => (
            <div key={i} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <span className="text-xs font-bold text-slate-500 shrink-0 pt-0.5">{z.label}</span>
              <span className={cn(
                'text-base font-bold text-right break-words',
                z.problem ? 'text-brand-red' : 'text-slate-900'
              )}>
                {z.wert}
              </span>
            </div>
          ))}
        </div>

        {drohnen.length > 1 && (
          <label className="mt-3 flex items-center gap-2 rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3">
            <span className="text-xs font-bold text-slate-500">{tx('Drohne', 'Drone')}</span>
            <div className="relative flex-1">
              <select
                value={drohnenId}
                onChange={e => setDrohnenId(e.target.value)}
                className="w-full appearance-none bg-transparent text-sm font-bold text-slate-900 text-right pr-6 outline-none"
              >
                {drohnen.map(d => (
                  <option key={d.id} value={d.id} className="text-slate-900">
                    {d.name || d.model}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </label>
        )}

        {dokumente.length > 0 && (
          <div className="mt-5">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 px-1 mb-2">{tx('Dokumente zum Vorzeigen', 'Documents to show')}</p>
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-200 overflow-hidden">
              {dokumente.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => window.open(URL.createObjectURL(d.data), '_blank')}
                  className="w-full flex items-center gap-3 px-4 h-14 text-left hover:bg-slate-50"
                >
                  <FileDigit className="w-5 h-5 text-brand-blue shrink-0" />
                  <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{d.name}</span>
                  <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
