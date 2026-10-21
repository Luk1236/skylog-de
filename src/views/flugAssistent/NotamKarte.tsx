import { AlertTriangle } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { formatNotamDate, summariseNotam, type Notam } from '../../services/notam';

/** Aktive NOTAMs der FIR am Standort - oder der Hinweis, wie man den Feed aktiviert. */
export function NotamKarte({ aktiv, notams, laedt, fir }: {
  /** NOTAM-Zugang (FAA) im Profil eingetragen. */
  aktiv: boolean;
  notams: Notam[];
  laedt: boolean;
  fir: string;
}) {
  const { tx } = useSprache();

  if (!aktiv) {
    return (
      <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
        <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
        <p className="text-xs text-slate-500 leading-tight">
          <span className="font-bold">{tx('NOTAM-Feed nicht aktiviert.', 'NOTAM feed not enabled.')}</span> {tx('API-Key unter Profil eingeben (developer.faa.gov · kostenlos).', 'Enter an API key in your profile (developer.faa.gov · free).')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-bold text-slate-900">
            Live NOTAMs · {fir}
          </p>
        </div>
        {laedt && (
          <span className="text-2xs text-slate-400 animate-pulse">{tx('Laden…', 'Loading…')}</span>
        )}
      </div>
      {!laedt && notams.length === 0 && (
        <p className="text-xs text-brand-green font-bold text-center py-2">
          {tx('Keine aktiven NOTAMs für', 'No active NOTAMs for')} {fir}
        </p>
      )}
      {notams.length > 0 && (
        <div className="space-y-2">
          {notams.map(n => (
            <div key={n.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs font-bold text-amber-800">{n.location} · {n.type}</span>
                <span className="text-2xs text-slate-500">{formatNotamDate(n.startDate)}</span>
              </div>
              <p className="text-2xs text-slate-700 leading-snug font-mono">{summariseNotam(n.text)}</p>
              {n.endDate && (
                <p className="text-2xs text-slate-500 mt-1">{tx('bis', 'until')} {formatNotamDate(n.endDate)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
