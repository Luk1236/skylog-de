import { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import {
  holeZonen, bewerteZonen, formatGrenzen, betrifftHoehe, zonenLabel, type Zone,
} from '../services/airspaceZones';
import { dipulDecktAb, istGrenzregion, quellenFuerKoordinate } from '../services/euZones';

interface Props {
  lat: number;
  lon: number;
  /** Geplante Flughöhe in Metern über Grund — blendet Zonen aus, die erst
   *  darüber beginnen oder darunter enden. */
  planHoeheM?: number;
}

// Bedeutungsfarben aus der Palette (DESIGN.md) - passen sich dem Dunkelmodus an.
const STUFE_KLASSE: Record<string, string> = {
  frei: 'bg-emerald-50 border-emerald-100 text-brand-green',
  hinweis: 'bg-amber-50 border-amber-100 text-amber-800',
  kritisch: 'bg-red-50 border-red-100 text-brand-red',
};

// Fragt die amtlichen Geo-Zonen (dipul/DFS) am Standort ab und fasst sie zu
// einem Urteil zusammen — mit Höhengrenzen und Rechtsgrundlage je Zone.
export function AirspaceCheckPanel({ lat, lon, planHoeheM }: Props) {
  const { tx, sprache } = useSprache();
  const [zonen, setZonen] = useState<Zone[] | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      setZonen(await holeZonen(lat, lon));
    } catch {
      setFehler(tx('Zonendaten nicht erreichbar.', 'Zone data unavailable.'));
      setZonen(null);
    } finally {
      setLaeuft(false);
    }
  };

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lon)) laden();
    // Bewusst nur bei Positionswechsel neu laden (laden ist pro Render neu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  // Wenn eine Flughöhe bekannt ist, nur die vertikal betroffenen Zonen zeigen.
  const relevant = (zonen ?? []).filter(
    z => planHoeheM === undefined || betrifftHoehe(z, planHoeheM)
  );
  const urteil = bewerteZonen(relevant);
  const stufeKlasse = STUFE_KLASSE[urteil.stufe];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-brand-blue" />
          <h3 className="text-sm font-bold text-slate-900">{tx('Luftraum am Standort', 'Airspace at location')}</h3>
        </div>
        <button onClick={laden} aria-label={tx('Zonen neu laden', 'Reload zones')} disabled={laeuft}
          className="p-1 text-slate-500 hover:text-brand-blue disabled:opacity-40">
          <RefreshCw className={cn('w-4 h-4', laeuft && 'animate-spin')} />
        </button>
      </div>

      {/* Wichtiger als jede Zonenanzeige: Das dipul-Overlay gilt NUR für
          Deutschland. Ohne diesen Hinweis liest sich „keine Zonen gefunden"
          im Ausland als „hier ist frei" — der gefährlichste Irrtum, den diese
          App produzieren könnte. */}
      {!dipulDecktAb(lat, lon) && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 mb-3">
          <p className="text-2xs text-amber-800 flex items-start gap-1.5 leading-relaxed font-bold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {tx('Außerhalb Deutschlands — diese Zonenanzeige gilt hier nicht.', 'Outside Germany — this zone display does not apply here.')}
          </p>
          <p className="text-2xs text-amber-700 mt-1 leading-relaxed">
            {tx('Die eingebauten Daten (dipul/DFS) decken nur Deutschland ab. Prüfe den Standort bei der zuständigen Stelle:', 'The built-in data (dipul/DFS) only covers Germany. Check the location with the competent authority:')}
          </p>
          <div className="mt-2 space-y-1">
            {quellenFuerKoordinate(lat, lon).map(q => (
              <a key={q.code} href={q.url} target="_blank" rel="noopener noreferrer"
                className="text-2xs font-bold text-brand-blue flex items-center gap-1">
                {sprache === 'en' ? q.landEn : q.land} <ExternalLink className="w-3 h-3" />
              </a>
            ))}
            {quellenFuerKoordinate(lat, lon).length === 0 && (
              <p className="text-2xs text-amber-700">
                {tx('Für dieses Land ist keine Quelle hinterlegt — bitte die nationale Luftfahrtbehörde prüfen.', 'No source is stored for this country — please check with the national aviation authority.')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Grenznähe: dipul gilt hier, aber der Nachbar ist in Reichweite. */}
      {dipulDecktAb(lat, lon) && istGrenzregion(lat, lon) && (
        <p className="text-2xs text-slate-500 mb-2 leading-relaxed">
          {tx('Grenznah — jenseits der Grenze gelten andere Zonen:', 'Near the border — other zones apply across the border:')}{' '}
          {quellenFuerKoordinate(lat, lon).filter(q => q.code !== 'DE').map(q => (
            <a key={q.code} href={q.url} target="_blank" rel="noopener noreferrer"
              className="text-brand-blue font-bold underline mr-2">{sprache === 'en' ? q.landEn : q.land}</a>
          ))}
        </p>
      )}

      {fehler && (
        <p className="text-2xs text-brand-red flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {fehler}
        </p>
      )}

      {!fehler && zonen !== null && (
        <>
          <div className={`rounded-xl p-3 mb-3 flex items-start gap-2 border ${stufeKlasse}`}>
            {urteil.stufe === 'frei'
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <p className="text-xs font-medium leading-snug">
              {sprache === 'en' ? urteil.textEn : urteil.text}
            </p>
          </div>

          {relevant.length > 0 && (
            <div className="space-y-2">
              {relevant.map((z, i) => (
                <div key={`${z.layer}-${i}`} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-900 leading-tight">{z.name}</span>
                    <span className={cn(
                      'text-2xs font-bold px-1.5 py-0.5 rounded shrink-0',
                      z.stufe === 'kritisch' ? 'bg-brand-red/10 text-brand-red' : 'bg-amber-50 text-amber-800'
                    )}>
                      {zonenLabel(z, sprache)}
                    </span>
                  </div>
                  <p className="text-2xs text-slate-500">{tx('Höhe', 'Altitude')}: {formatGrenzen(z, sprache)}</p>
                  {z.rechtsgrundlage && (
                    <p className="text-2xs text-slate-400 mt-0.5">{z.rechtsgrundlage}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <a href="https://maptool-dipul.dfs.de/" target="_blank" rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1 text-2xs font-bold text-brand-blue">
            <ExternalLink className="w-3 h-3" /> {tx('Amtliche Karte (dipul) öffnen', 'Open official map (dipul)')}
          </a>
          <p className="text-2xs text-slate-400 mt-2 leading-relaxed">
            {tx('Abfrage im Umkreis von 500 m um deinen Standort. Orientierungshilfe — verbindlich ist die amtliche dipul-Karte.', 'Query within 500 m of your location. For guidance only — the official dipul map is binding.')}
          </p>
        </>
      )}
    </div>
  );
}
