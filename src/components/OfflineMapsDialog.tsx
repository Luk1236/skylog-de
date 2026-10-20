import { useEffect, useState } from 'react';
import { Download, Trash2, Check, MapPin, AlertTriangle, Map as KartenIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { cn } from '../lib/utils';
import { dbService, type GespeicherteKarte } from '../services/db';
import { REGIONEN, regionenFuerStandort, type KartenRegion } from '../services/mapRegions';
import { ladeRegion, type Fortschritt } from '../services/mapDownload';
import { formatBytes } from '../services/offlineMap';
import { bestaetige, melde } from '../services/dialog';
import { useSprache } from '../lib/sprache';
import { Dialog, Knopf } from './ui';

interface Props {
  lat: number;
  lon: number;
  onClose: () => void;
  onGeaendert: () => void;
}

export function OfflineMapsDialog({ lat, lon, onClose, onGeaendert }: Props) {
  const { tx } = useSprache();
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
    } catch (err) {
      melde((err instanceof Error && err.message) || tx('Download fehlgeschlagen.', 'Download failed.'), tx('Karte nicht geladen', 'Map not loaded'));
    } finally {
      setLaeuft(null);
      setFortschritt(null);
    }
  };

  const loeschen = async (karte: GespeicherteKarte) => {
    if (!await bestaetige(tx(`„${karte.name}“ vom Gerät löschen?`, `Delete “${karte.name}” from this device?`), { gefaehrlich: true })) return;
    await dbService.deleteMapRegion(karte.code);
    await aktualisieren();
    onGeaendert();
  };

  const belegt = gespeichert.reduce((s, k) => s + k.groesse, 0);

  return (
    <Dialog
      titel={tx('Offline-Karten', 'Offline maps')}
      icon={KartenIcon}
      breite="md"
      onClose={onClose}
    >
      <p className="text-xs text-slate-500 leading-relaxed">
        {tx('Karten für den Einsatz ohne Netz. Lade die Region, in der du fliegst — nicht alle.', 'Maps for use without a network. Download the region you fly in — not all of them.')} {belegt > 0 && <>{tx('Belegt:', 'Used:')} <span className="font-bold">{formatBytes(belegt)}</span>.</>}
      </p>

      <div className="space-y-2">
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
                    <p className="text-sm font-bold text-slate-900 truncate">{region.name}</p>
                    {istHier && (
                      <span className="text-2xs font-bold text-brand-blue uppercase tracking-wider flex items-center gap-0.5 shrink-0">
                        <MapPin className="w-3 h-3" /> {tx('hier', 'here')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {da
                      ? `Geladen · ${formatBytes(da.groesse)}`
                      : `Zoom bis ${region.maxZoom}`}
                  </p>
                </div>

                {da ? (
                  <>
                    <Check className="w-4 h-4 text-brand-green shrink-0" />
                    <button onClick={() => loeschen(da)} aria-label={`${region.name} löschen`}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-brand-red hover:bg-red-50 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <Knopf groesse="sm" icon={Download} onClick={() => laden(region)} disabled={laeuft !== null} className="shrink-0">
                    {amLaden ? 'Lädt…' : 'Laden'}
                  </Knopf>
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
                  <p className="text-2xs text-slate-500 mt-1">
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
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
        <p className="text-xs text-amber-800 flex items-start gap-1.5 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {tx('Offline-Karten zeigen nur das Gelände. Flugverbotszonen brauchen weiterhin eine Internetverbindung — prüfe sie vor dem Start.', 'Offline maps only show the terrain. No-fly zones still need an internet connection — check them before take-off.')}
        </p>
      </div>
    </Dialog>
  );
}
