import { useEffect, useState, type ChangeEvent } from 'react';
import { Upload, Trash2, ExternalLink, AlertTriangle, Globe2, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { dbService, type GespeicherteZonen } from '../services/db';
import { parseEd269 } from '../services/ed269';
import { ZONEN_QUELLEN } from '../services/euZones';
import { melde, bestaetige } from '../services/dialog';
import { useSprache } from '../lib/sprache';
import { cn } from '../lib/utils';
import { Dialog, Knopf, Abschnitt, knopfKlassen } from './ui';

interface Props {
  onClose: () => void;
  onGeaendert: () => void;
}

/** Wie alt ist der Stand? Zonendaten veralten — das muss sichtbar sein. */
function alterText(importiertAm: number, tx: (de: string, en: string) => string): { text: string; warnen: boolean } {
  const tage = Math.floor((Date.now() - importiertAm) / 86_400_000);
  if (tage <= 0) return { text: tx('heute importiert', 'imported today'), warnen: false };
  if (tage === 1) return { text: tx('gestern importiert', 'imported yesterday'), warnen: false };
  return { text: tx(`vor ${tage} Tagen importiert`, `imported ${tage} days ago`), warnen: tage > 30 };
}

export function EuZonesDialog({ onClose, onGeaendert }: Props) {
  const { tx } = useSprache();
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
        melde(tx('In der Datei waren keine darstellbaren Zonen.', 'The file contained no zones that can be shown.'), tx('Nichts importiert', 'Nothing imported'));
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
      melde(tx(`${zonen.length} Zonen für ${land} übernommen.`, `${zonen.length} zones imported for ${land}.`), tx('Import erfolgreich', 'Import successful'));
    } catch (err) {
      melde((err instanceof Error && err.message) || tx('Die Datei konnte nicht gelesen werden.', 'The file could not be read.'), tx('Import fehlgeschlagen', 'Import failed'));
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
        melde(tx('Die Quelle lieferte keine darstellbaren Zonen.', 'The source returned no zones that can be shown.'), tx('Nichts geladen', 'Nothing loaded'));
        return;
      }
      const land = zonen[0].land || quelle.code;
      await dbService.saveEuZonen({
        land, zonen, anzahl: zonen.length, importiertAm: Date.now(), dateiname: quelle.url,
      });
      await aktualisieren();
      onGeaendert();
      melde(tx(`${zonen.length} Zonen für ${quelle.land} geladen.`, `${zonen.length} zones loaded for ${quelle.land}.`), tx('Aktualisiert', 'Updated'));
    } catch (err) {
      melde((err instanceof Error && err.message) || tx('Die Quelle war nicht erreichbar.', 'The source could not be reached.'), tx('Laden fehlgeschlagen', 'Loading failed'));
    } finally {
      setLaeuft(false);
    }
  };

  const loeschen = async (eintrag: GespeicherteZonen) => {
    if (!await bestaetige(tx(`Zonen für ${eintrag.land} löschen?`, `Delete zones for ${eintrag.land}?`), { gefaehrlich: true })) return;
    await dbService.deleteEuZonen(eintrag.land);
    await aktualisieren();
    onGeaendert();
  };

  return (
    <Dialog
      titel={tx('Zonen anderer Länder', 'Zones of other countries')}
      icon={Globe2}
      breite="lg"
      onClose={onClose}
      fuss={
        // Datei-Auswahl braucht ein <label> - Knopf-Optik über knopfKlassen.
        <label className={cn(knopfKlassen('primaer', 'md', true), laeuft && 'opacity-50')}>
          <Upload className="w-4 h-4" />
          {laeuft ? 'Wird gelesen…' : 'ED-269-Datei importieren'}
          <input type="file" accept=".json,application/json" className="hidden" onChange={importieren} disabled={laeuft} />
        </label>
      }
    >
      <p className="text-sm text-slate-700 leading-relaxed">
        {tx('Das eingebaute Overlay gilt nur für Deutschland. Für andere Länder lädst du die amtliche Zonendatei (ED-269) herunter und importierst sie hier.', 'The built-in overlay covers Germany only. For other countries, download the official zone file (ED-269) and import it here.')}
      </p>

      {gespeichert.length > 0 && (
        <div>
          <Abschnitt titel={tx('Importiert', 'Imported')} />
          <div className="space-y-2">
            {gespeichert.map(e => {
              const alter = alterText(e.importiertAm, tx);
              return (
                <div key={e.land} className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{e.land} · {e.anzahl} {tx('Zonen', 'Zones')}</p>
                    <p className={alter.warnen ? 'text-xs text-brand-red font-bold' : 'text-xs text-slate-500'}>
                      {alter.text}{alter.warnen && tx(' — bitte erneuern', ' — please renew')}
                    </p>
                  </div>
                  <button onClick={() => loeschen(e)} aria-label={tx(`Zonen ${e.land} löschen`, `Delete zones ${e.land}`)}
                    className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-brand-red shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Abschnitt titel={tx('Amtliche Quellen', 'Official sources')} />
        <div className="space-y-2">
          {ZONEN_QUELLEN.filter(q => q.code !== 'DE').map(q => (
            <div key={q.code} className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 pl-3 pr-1.5 py-1.5">
              <span className="text-xs font-bold text-slate-900 flex-1">{q.land}</span>
              {q.direktUrl ? (
                <Knopf variante="sekundaer" groesse="sm" icon={RefreshCw} onClick={() => direktLaden(q)} disabled={laeuft}>
                  {tx('Laden', 'Load')}{q.groesseMB ? ` (${q.groesseMB} MB)` : ''}
                </Knopf>
              ) : q.maschinenlesbar ? (
                <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{tx('Datei von Hand', 'File by hand')}</span>
              ) : (
                <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{tx('nur Karte', 'map only')}</span>
              )}
              <a href={q.url} target="_blank" rel="noopener noreferrer" aria-label={`${q.land} öffnen`}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-brand-blue shrink-0">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
        <p className="text-xs text-amber-800 flex items-start gap-2 leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {tx('Zonendaten ändern sich. Die App lädt sie bewusst nicht automatisch nach — ein stillschweigend veralteter Stand wäre gefährlicher als keiner. Vor Flügen im Ausland die Datei neu holen.', 'Zone data changes. The app deliberately does not refresh it automatically — silently outdated data would be more dangerous than none. Fetch the file again before flying abroad.')}
        </p>
      </div>
    </Dialog>
  );
}
