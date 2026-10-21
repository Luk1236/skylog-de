import { BadgeAlert, Clock, Plane, Settings2, Sparkles, Trash2, Wrench } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import type { Drone, Flight, MaintenanceRecord } from '../../services/db';
import { wartungStatus, garantieStatus, gesamtKosten } from '../../services/maintenance';
import { IconKnopf, Knopf } from '../../components/ui';
import type { DrohnenStatistik, WartungsHinweis } from './wartungsHinweise';

/** Karte einer Drohne: Kennzahlen, Wartung, Garantie, Kosten und Hinweise. */
export function DrohnenKarte({ drohne, fluege, stats, wartungen, hinweise, onBearbeiten, onWartung, onLoeschen, onMotorenGereinigt }: {
  drohne: Drone;
  /** Flüge dieser Drohne. */
  fluege: Flight[];
  stats: DrohnenStatistik | undefined;
  /** Alle Wartungseinträge (für Status und Kosten). */
  wartungen: MaintenanceRecord[];
  hinweise: WartungsHinweis[];
  onBearbeiten: () => void;
  onWartung: () => void;
  onLoeschen: () => void;
  onMotorenGereinigt: () => void;
}) {
  const { tx, sprache } = useSprache();
  const minutenGesamt = fluege.reduce((summe, f) => summe + (f.duration || 0), 0);
  const stunden = Math.floor(minutenGesamt / 60);
  const minuten = minutenGesamt % 60;
  const wStatus = wartungStatus(drohne, fluege, wartungen);
  const gStatus = garantieStatus(drohne);
  const wartungsKosten = gesamtKosten(wartungen, drohne.id);
  const letzteMotorreinigung = stats?.lastMaint['Motor'];

  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
      {/* Kopf: Bild, Name, Aktionen */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-brand-blue/5 flex items-center justify-center border border-brand-blue/10 overflow-hidden shrink-0">
          {drohne.photoUrl
            ? <img src={drohne.photoUrl} alt={drohne.model} className="w-full h-full object-cover" />
            : <Plane className="w-5 h-5 text-brand-blue" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate">{drohne.model}</h3>
          <p className="text-xs text-slate-500 truncate">
            {drohne.uasClass || 'Legacy'} · {drohne.weight} g{drohne.serialNumber && ` · SN ${drohne.serialNumber}`}
          </p>
        </div>
        <div className="flex -mr-2 -mt-1">
          <IconKnopf icon={Settings2} aria-label={tx('Bearbeiten', 'Edit')} onClick={onBearbeiten} />
          <IconKnopf icon={Wrench} aria-label={tx('Wartung', 'Maintenance')} onClick={onWartung} />
          <IconKnopf icon={Trash2} variante="gefahr" aria-label={tx('Löschen', 'Delete')} onClick={onLoeschen} />
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-slate-600">
        <span className="flex items-center gap-1 font-bold text-brand-blue">
          <Clock className="w-3.5 h-3.5" /> {stunden} h {minuten} min
        </span>
        <span>{fluege.length} {tx('Flüge', 'Flights')}</span>
        {drohne.firmwareVersion && <span>FW {drohne.firmwareVersion}</span>}
      </div>

      {/* Wartung / Garantie / Kosten */}
      {(wStatus.level !== 'ok' || gStatus.status !== 'keine' || wartungsKosten > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {wStatus.level !== 'ok' && (
            <span className={cn(
              'text-2xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1',
              wStatus.level === 'alert' ? 'bg-red-50 text-brand-red' : 'bg-amber-50 text-amber-800'
            )} title={(sprache === 'en' ? wStatus.gruendeEn : wStatus.gruende).join(' ')}>
              <Wrench className="w-3 h-3" /> {tx('Wartung', 'Maintenance')} {wStatus.level === 'alert' ? tx('fällig', 'due') : tx('bald', 'soon')}
            </span>
          )}
          {gStatus.status === 'aktiv' && (
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-brand-green">
              {tx('Garantie', 'Warranty')} {gStatus.tage} {tx('Tage', 'days')}
            </span>
          )}
          {gStatus.status === 'bald' && (
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
              {tx('Garantie endet in', 'Warranty ends in')} {gStatus.tage} {tx('Tagen', 'days')}
            </span>
          )}
          {gStatus.status === 'abgelaufen' && (
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {tx('Garantie abgelaufen', 'Warranty expired')}
            </span>
          )}
          {wartungsKosten > 0 && (
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {wartungsKosten.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Knopf variante="sekundaer" groesse="sm" icon={Sparkles} onClick={onMotorenGereinigt}>
          {tx('Motoren reinigen', 'Clean motors')}
        </Knopf>
        {letzteMotorreinigung && (
          <span className="text-xs text-slate-500">{tx('Zuletzt:', 'Last:')} {new Date(letzteMotorreinigung).toLocaleDateString('de-DE')}</span>
        )}
      </div>

      {hinweise.length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl space-y-2">
          <div className="flex items-center gap-2">
            <BadgeAlert className="w-4 h-4 text-amber-800" />
            <span className="text-xs font-bold text-amber-800">{tx('Sicherheits-Check fällig', 'Safety check due')}</span>
          </div>
          {hinweise.map((hinweis, idx) => (
            <div key={idx} className="bg-white p-3 rounded-xl">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">{hinweis.reason}</span>
                <span className="text-2xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">{hinweis.type === 'General' ? tx('Allgemein', 'General') : hinweis.type}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">{hinweis.detail}</p>
            </div>
          ))}
          <Knopf groesse="sm" voll onClick={onWartung}>
            {tx('Wartung protokollieren', 'Log maintenance')}
          </Knopf>
        </div>
      )}
    </div>
  );
}
