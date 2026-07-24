import { useEffect, useState } from 'react';
import { X, Download, Trash2, Check, MapPin, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { cn } from '../lib/utils';
import { dbService, type GespeicherteKarte } from '../services/db';
import { REGIONEN, regionenFuerStandort, type KartenRegion } from '../services/mapRegions';
import { ladeRegion, type Fortschritt } from '../services/mapDownload';
import { formatBytes } from '../services/offlineMap';
import { bestaetige, melde } from '../services/dialog';
import { useSprache } from '../lib/sprache';

interface Props {
  lat: number;
  lon: number;
  onClose: () => void;
  onGeaendert: () => void;
}

export function OfflineMapsDialog({ lat, lon, onClose, onGeaendert }: Props) {
  const { t } = useSprache();
  const [gespeichert, setGespeichert] = useState<GespeicherteKarte[]>([]);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fortschritt, setFortschritt] = useState<Fortschritt | null>(null);

  const aktualisieren = async () => setGespeichert(await dbService.getMapRegions());
  useEffect(() => { aktualisieren(); }, []);

  const hier = regionenFuerStandort(lat, lon).map(r => r.code);

  const laden = async (region: KartenRegion) => {
    setLaeuft(region.code);
    setFortschritt(null);
    try {
      await ladeRegion(region, Capacitor.isNativePlatform(), setFortschritt);
      await aktualisieren();
      onGeaendert();
    } catch (err: any) {
      melde(err?.message || 'Download fehlgeschlagen.', 'Karte nicht geladen');
    } finally {
      setLaeuft(null);
      setFortschritt(null);
    }
  };

  const loeschen = async (karte: GespeicherteKarte) => {
    if (!await bestaetige(`„${karte.name}" vom Gerät löschen?`, { gefaehrlich: true })) return;
    await dbService.deleteMapRegion(karte.code);
    await aktualisieren();
    onGeaendert();
  };

  const belegt = gespeichert.reduce((s, k) => s + k.groesse, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <h3 className="font-black text-slate-900">Offline-Karten</h3>
          <button onClick={onClose} aria-label={t('aktion.schliessen')} className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-2">
          <p className="text-[11px] text-slate-500 leading-relaxed px-1">
            Karten für den Einsatz ohne Netz. Lade die Region, in der du fliegst —
            nicht alle. {belegt > 0 && <>Belegt: <span className="font-bold">{formatBytes(belegt)}</span>.</>}
          </p>

          {REGIONEN.map(region => {
            const da = gespeichert.find(k => k.code === region.code);
            const istHier = hier.includes(region.code);
            const amLaden = laeuft === region.code;

            return (
              <div key={region.code} className={cn(
                'rounded-2xl border p-3',
                istHier ? 'bg-brand-blue/5 border-brand-blue/30' : 'bg-white border-slate-200'
              )}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 truncate">{region.name}</p>
                      {istHier && (
                        <span className="text-[9px] font-black text-brand-blue uppercase tracking-wider flex items-center gap-0.5 shrink-0">
                          <MapPin className="w-3 h-3" /> hier
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {da
                        ? `Geladen · ${formatBytes(da.groesse)}`
                        : `Zoom bis ${region.maxZoom}`}
                    </p>
                  </div>

                  {da ? (
                    <>
                      <Check className="w-4 h-4 text-brand-green shrink-0" />
                      <button onClick={() => loeschen(da)} aria-label={`${region.name} löschen`}
                        className="p-1.5 text-slate-300 hover:text-brand-red shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => laden(region)} disabled={laeuft !== null}
                      className="bg-brand-blue text-white font-bold px-3 py-2 rounded-xl text-[11px] active:scale-95 disabled:opacity-40 flex items-center gap-1.5 shrink-0">
                      <Download className="w-3.5 h-3.5" />
                      {amLaden ? 'Lädt…' : 'Laden'}
                    </button>
                  )}
                </div>

                {amLaden && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full bg-brand-blue', fortschritt?.prozent === null && 'animate-pulse w-1/3')}
                        style={fortschritt?.prozent !== null && fortschritt
                          ? { width: `${fortschritt.prozent}%` }
                          : undefined}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {fortschritt?.prozent !== null && fortschritt
                        ? `${fortschritt.prozent}% · ${formatBytes(fortschritt.geladen)}`
                        : fortschritt
                          ? `${formatBytes(fortschritt.geladen)} geladen`
                          : 'Wird gestartet…'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 mt-2">
            <p className="text-[10px] text-amber-800 flex items-start gap-1.5 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Offline-Karten zeigen nur das Gelände. Flugverbotszonen brauchen
              weiterhin eine Internetverbindung — prüfe sie vor dem Start.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
