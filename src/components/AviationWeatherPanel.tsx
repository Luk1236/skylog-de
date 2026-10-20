import { useEffect, useState } from 'react';
import { Radio, RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import {
  holeMetar, holeTaf, bewerteFltCat, knotenInKmh,
  type MetarStation, type TafMeldung,
} from '../services/aviationWeather';

interface Props {
  lat: number;
  lon: number;
}

// Bedeutungsfarben aus der Palette (DESIGN.md) - passen sich dem Dunkelmodus an.
const LAGE_KLASSE: Record<string, string> = {
  gut: 'bg-emerald-50 border-emerald-100 text-brand-green',
  eingeschraenkt: 'bg-amber-50 border-amber-100 text-amber-800',
  schlecht: 'bg-red-50 border-red-100 text-brand-red',
  unbekannt: 'bg-slate-50 border-slate-200 text-slate-600',
};

// Luftfahrtwetter der nächstgelegenen Flugplatz-Station. Ergänzt das
// Punktwetter (open-meteo) um das, was die Luftfahrt tatsächlich meldet:
// Sicht, Wolkenuntergrenze und die zusammenfassende Kategorie.
export function AviationWeatherPanel({ lat, lon }: Props) {
  const { tx, sprache } = useSprache();
  const [station, setStation] = useState<MetarStation | null>(null);
  const [taf, setTaf] = useState<TafMeldung | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [tafOffen, setTafOffen] = useState(false);

  const laden = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      const s = await holeMetar(lat, lon);
      setStation(s);
      if (s) {
        // TAF ist optional — ein Fehler hier darf das METAR nicht wegnehmen.
        try { setTaf(await holeTaf(s.icaoId)); } catch { setTaf(null); }
      }
    } catch {
      setFehler(tx('Luftfahrtwetter nicht erreichbar.', 'Aviation weather unavailable.'));
    } finally {
      setLaeuft(false);
    }
  };

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lon)) laden();
    // absichtlich nur bei Positionswechsel neu laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  const bewertung = bewerteFltCat(station?.fltCat ?? null);
  const lageKlasse = LAGE_KLASSE[bewertung.lage];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-brand-blue" />
          <span className="text-2xs font-black text-slate-900 uppercase tracking-wider">{tx('Luftfahrtwetter', 'Aviation weather')}</span>
        </div>
        <button onClick={laden} aria-label={tx('Luftfahrtwetter neu laden', 'Reload aviation weather')} disabled={laeuft}
          className="p-1 text-slate-500 hover:text-brand-blue disabled:opacity-40">
          <RefreshCw className={cn('w-4 h-4', laeuft && 'animate-spin')} />
        </button>
      </div>

      {fehler && (
        <p className="text-2xs text-brand-red flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {fehler}
        </p>
      )}

      {!fehler && !station && !laeuft && (
        <p className="text-2xs text-slate-400">{tx('Keine Station in Reichweite gefunden.', 'No station found within range.')}</p>
      )}

      {station && (
        <>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-bold text-slate-800">
              {station.icaoId} · {station.name.split(',')[0]}
            </span>
            {station.entfernungKm !== undefined && (
              <span className="text-2xs text-slate-400">{tx(`${station.entfernungKm} km entfernt`, `${station.entfernungKm} km away`)}</span>
            )}
          </div>

          <div className={`rounded-xl p-3 mb-3 border ${lageKlasse}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black">
                {station.fltCat ?? '—'}
              </span>
              <span className="text-2xs text-slate-600 leading-snug">{sprache === 'en' ? bewertung.textEn : bewertung.text}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            <Wert label="Wind" wert={
              station.wspd !== null
                ? `${station.wdir ?? '—'}° / ${knotenInKmh(station.wspd)} km/h`
                : '—'
            } />
            <Wert label={tx('Sicht', 'Visib.')} wert={station.visib ?? '—'} />
            <Wert label="Temp" wert={station.temp !== null ? `${station.temp}°C` : '—'} />
            <Wert label="QNH" wert={station.altim !== null ? `${Math.round(station.altim)}` : '—'} />
          </div>

          {station.rawOb && (
            <p className="text-2xs font-mono text-slate-400 leading-relaxed break-all bg-slate-50 rounded-lg p-2">
              {station.rawOb}
            </p>
          )}

          {taf?.rawTAF && (
            <div className="mt-2">
              <button onClick={() => setTafOffen(o => !o)}
                className="flex items-center gap-1 text-2xs font-bold text-slate-400 uppercase tracking-wider">
                <ChevronDown className={cn('w-3 h-3 transition-transform', tafOffen && 'rotate-180')} />
                {tx('Vorhersage (TAF)', 'Forecast (TAF)')}
              </button>
              {tafOffen && (
                <p className="mt-1 text-2xs font-mono text-slate-400 leading-relaxed break-all bg-slate-50 rounded-lg p-2">
                  {taf.rawTAF}
                </p>
              )}
            </div>
          )}

          <p className="text-2xs text-slate-400 mt-2 leading-relaxed">
            {tx('Meldung eines Flugplatzes in der Nähe — beschreibt nicht zwingend deinen genauen Standort, ist aber der verlässlichste Anhalt für Sicht und Wolken.', 'Report from a nearby airfield — it does not necessarily describe your exact location, but it is the most reliable reference for visibility and clouds.')}
          </p>
        </>
      )}
    </div>
  );
}

function Wert({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2 text-center">
      <p className="text-xs font-black text-slate-900 leading-tight">{wert}</p>
      <p className="text-2xs text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
