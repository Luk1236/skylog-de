import { AlertTriangle, Image as ImageIcon, Moon, Route, ShieldAlert, Trash2, User, Wind } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import type { Drone, Flight } from '../../services/db';
import { IconKnopf } from '../../components/ui';

/** Ein Flug in der Liste: Ort, Datum, Drohne, Dauer, Auffälligkeiten und Aktionen. */
export function FlugKarte({ flug, drohne, datumText, onMedien, onTrack, onLoeschen }: {
  flug: Flight;
  drohne: Drone | undefined;
  datumText: (datum: string) => string;
  onMedien: () => void;
  onTrack: () => void;
  onLoeschen: () => void;
}) {
  const { tx } = useSprache();
  const hatMedien = !!flug.media && flug.media.length > 0;
  const hatTrack = !!flug.track && flug.track.length > 0;
  const wetterWarnung = !!flug.weather && (flug.weather.windSpeed > 15 || flug.weather.temp > 30);
  const tiefentladung = flug.batteryStatus?.endPercent != null && flug.batteryStatus.endPercent < 15;
  const abzeichen = flug.isNightFlight || flug.coPilotName || wetterWarnung || tiefentladung || flug.incidents;

  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{flug.locationName}</p>
          <p className="text-xs text-slate-500">
            {datumText(flug.date)} · {drohne?.model || tx('Gelöschte Drohne', 'Deleted drone')} · {flug.duration} min
            {flug.legs && flug.legs.length > 0 && <> · {flug.legs.length} {tx('Abschnitte', 'segments')}</>}
          </p>
        </div>
        <div className="flex shrink-0 -mr-2 -mt-1">
          <IconKnopf
            icon={ImageIcon}
            aria-label={hatMedien ? tx('Bilder zum Flug ansehen', 'View flight photos') : tx('Bilder hinzufügen', 'Add photos')}
            onClick={onMedien}
            className={cn(hatMedien && 'text-brand-blue bg-brand-blue/10')}
          />
          <IconKnopf
            icon={Route}
            aria-label={hatTrack ? tx('Flug-Track ansehen', 'View flight track') : tx('Flug-Track hinzufügen', 'Add flight track')}
            onClick={onTrack}
            className={cn(hatTrack && 'text-brand-blue bg-brand-blue/10')}
          />
          <IconKnopf icon={Trash2} variante="gefahr" aria-label={tx('Flug löschen', 'Delete flight')} onClick={onLoeschen} />
        </div>
      </div>
      {abzeichen && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {flug.isNightFlight && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full text-2xs font-bold text-slate-700">
              <Moon className="w-3 h-3" /> {tx('Nachtflug', 'Night flight')}
            </span>
          )}
          {flug.coPilotName && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-blue/10 rounded-full text-2xs font-bold text-brand-blue">
              <User className="w-3 h-3" /> Co: {flug.coPilotName}
            </span>
          )}
          {wetterWarnung && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-full text-2xs font-bold text-amber-800">
              <Wind className="w-3 h-3" /> {tx('Wetter-Warnung', 'Weather warning')}
            </span>
          )}
          {tiefentladung && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 rounded-full text-2xs font-bold text-brand-red">
              <ShieldAlert className="w-3 h-3" /> {tx('Tiefentladungs-Risiko', 'Deep discharge risk')}
            </span>
          )}
          {flug.incidents && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 rounded-full text-2xs font-bold text-brand-red">
              <AlertTriangle className="w-3 h-3" /> {tx('Vorkommnis', 'Occurrence')}
            </span>
          )}
        </div>
      )}
      {flug.incidents && <p className="text-xs text-brand-red mt-2">{flug.incidents}</p>}
      {flug.incidentPhoto && (
        <img src={flug.incidentPhoto} alt={tx('Vorkommnis', 'Occurrence')} className="mt-2 w-24 h-16 object-cover rounded-lg border border-brand-red/20" />
      )}
    </div>
  );
}
