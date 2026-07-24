import { useEffect, useState, type ChangeEvent } from 'react';
import { X, Upload, Trash2, ExternalLink, AlertTriangle, Globe2, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { dbService, type GespeicherteZonen } from '../services/db';
import { parseEd269 } from '../services/ed269';
import { ZONEN_QUELLEN } from '../services/euZones';
import { melde, bestaetige } from '../services/dialog';
import { useSprache } from '../lib/sprache';

interface Props {
  onClose: () => void;
  onGeaendert: () => void;
}

/** Wie alt ist der Stand? Zonendaten veralten — das muss sichtbar sein. */
function alterText(importiertAm: number): { text: string; warnen: boolean } {
  const tage = Math.floor((Date.now() - importiertAm) / 86_400_000);
  if (tage <= 0) return { text: 'heute importiert', warnen: false };
  if (tage === 1) return { text: 'gestern importiert', warnen: false };
  return { text: `vor ${tage} Tagen importiert`, warnen: tage > 30 };
}

export function EuZonesDialog({ onClose, onGeaendert }: Props) {
  const { t } = useSprache();
  const [gespeichert, setGespeichert] = useState<GespeicherteZonen[]>([]);
  const [laeuft, setLaeuft] = useState(false);

  const aktualisieren = async () => setGespeichert(await dbService.getEuZonen());
  useEffect(() => { aktualisieren(); }, []);

  const importieren = async (e: ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    setLaeuft(true);
    try {
      const zonen = parseEd269(await datei.text());
      if (zonen.length === 0) {
        melde('In der Datei waren keine darstellbaren Zonen.', 'Nichts importiert');
        return;
      }
      // Land aus den Daten selbst nehmen, nicht aus dem Dateinamen raten.
      const land = zonen[0].land || 'UNB';
      await dbService.saveEuZonen({
        land,
        zonen,
        anzahl: zonen.length,
        importiertAm: Date.now(),
        dateiname: datei.name,
      });
      await aktualisieren();
      onGeaendert();
      melde(`${zonen.length} Zonen für ${land} übernommen.`, 'Import erfolgreich');
    } catch (err: any) {
      melde(err?.message || 'Die Datei konnte nicht gelesen werden.', 'Import fehlgeschlagen');
    } finally {
      setLaeuft(false);
    }
  };

  /** Direkt von der amtlichen Quelle laden — nur für Länder mit STABILER
   *  Adresse. Nativ direkt, im Web über den Proxy (Luxemburg sendet keine
   *  CORS-Header). So bekommt der Pilot immer den aktuellen Stand, statt eine
   *  Kopie, die in der App vor sich hin altert. */
  const direktLaden = async (quelle: (typeof ZONEN_QUELLEN)[number]) => {
    if (!quelle.direktUrl) return;
    setLaeuft(true);
    try {
      const url = Capacitor.isNativePlatform() ? quelle.direktUrl : `/api/zonen/${quelle.code}`;
      const antwort = await fetch(url);
      if (!antwort.ok) throw new Error(`Quelle antwortete mit ${antwort.status}.`);
      const zonen = parseEd269(await antwort.text());
      if (zonen.length === 0) {
        melde('Die Quelle lieferte keine darstellbaren Zonen.', 'Nichts geladen');
        return;
      }
      const land = zonen[0].land || quelle.code;
      await dbService.saveEuZonen({
        land, zonen, anzahl: zonen.length, importiertAm: Date.now(), dateiname: quelle.url,
      });
      await aktualisieren();
      onGeaendert();
      melde(`${zonen.length} Zonen für ${quelle.land} geladen.`, 'Aktualisiert');
    } catch (err: any) {
      melde(err?.message || 'Die Quelle war nicht erreichbar.', 'Laden fehlgeschlagen');
    } finally {
      setLaeuft(false);
    }
  };

  const loeschen = async (eintrag: GespeicherteZonen) => {
    if (!await bestaetige(`Zonen für ${eintrag.land} löschen?`, { gefaehrlich: true })) return;
    await dbService.deleteEuZonen(eintrag.land);
    await aktualisieren();
    onGeaendert();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-brand-blue" />
            <h3 className="font-black text-slate-900">Zonen anderer Länder</h3>
          </div>
          <button onClick={onClose} aria-label={t('aktion.schliessen')} className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-[11px] text-slate-500 leading-relaxed px-1">
            Das eingebaute Overlay gilt nur für Deutschland. Für andere Länder lädst
            du die amtliche Zonendatei (ED-269) herunter und importierst sie hier.
          </p>

          <label className="w-full flex items-center justify-center gap-2 bg-brand-blue text-white font-bold py-3 rounded-2xl active:scale-95 cursor-pointer">
            <Upload className="w-4 h-4" />
            {laeuft ? 'Wird gelesen…' : 'ED-269-Datei importieren'}
            <input type="file" accept=".json,application/json" className="hidden" onChange={importieren} disabled={laeuft} />
          </label>

          {gespeichert.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Importiert</p>
              {gespeichert.map(e => {
                const alter = alterText(e.importiertAm);
                return (
                  <div key={e.land} className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900">{e.land} · {e.anzahl} Zonen</p>
                      <p className={alter.warnen ? 'text-[10px] text-brand-red font-bold' : 'text-[10px] text-slate-400'}>
                        {alter.text}{alter.warnen && ' — bitte erneuern'}
                      </p>
                    </div>
                    <button onClick={() => loeschen(e)} aria-label={`Zonen ${e.land} löschen`}
                      className="p-1.5 text-slate-300 hover:text-brand-red shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1.5">Amtliche Quellen</p>
            <div className="space-y-1">
              {ZONEN_QUELLEN.filter(q => q.code !== 'DE').map(q => (
                <div key={q.code} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
                  <span className="text-[11px] font-bold text-slate-700 flex-1">{q.land}</span>
                  {q.direktUrl ? (
                    <button onClick={() => direktLaden(q)} disabled={laeuft}
                      className="bg-brand-blue text-white font-bold px-2.5 py-1 rounded-lg text-[10px] active:scale-95 disabled:opacity-40 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Laden{q.groesseMB ? ` (${q.groesseMB} MB)` : ''}
                    </button>
                  ) : q.maschinenlesbar ? (
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Datei von Hand</span>
                  ) : (
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">nur Karte</span>
                  )}
                  <a href={q.url} target="_blank" rel="noopener noreferrer" aria-label={`${q.land} öffnen`}>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-[10px] text-amber-800 flex items-start gap-1.5 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Zonendaten ändern sich. Die App lädt sie bewusst nicht automatisch nach —
              ein stillschweigend veralteter Stand wäre gefährlicher als keiner. Vor
              Flügen im Ausland die Datei neu holen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
