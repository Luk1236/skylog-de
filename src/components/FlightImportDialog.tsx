import { useState, useMemo, type ChangeEvent } from 'react';
import { Upload, X, AlertTriangle, CheckCircle2, Info, FileDigit } from 'lucide-react';
import { cn } from '../lib/utils';
import { dbService, type Drone, type Flight } from '../services/db';
import {
  baueVorschau,
  passendeDrohne,
  zuFlug,
  type ImportVorschau,
  type SpaltenTreffer,
} from '../services/flightImport';

interface Props {
  drohnen: Drone[];
  vorhandeneFluege: Flight[];
  onClose: () => void;
  /** Wird nach erfolgreichem Import aufgerufen, damit die Liste neu lädt. */
  onImported: (anzahl: number) => void;
}

export function FlightImportDialog({ drohnen, vorhandeneFluege, onClose, onImported }: Props) {
  const [dateiName, setDateiName] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<ImportVorschau | null>(null);
  const [leseFehler, setLeseFehler] = useState<string | null>(null);
  const [abgewaehlt, setAbgewaehlt] = useState<Set<number>>(new Set());
  const [ersatzDrohne, setErsatzDrohne] = useState<string>(drohnen[0]?.id ?? '');
  const [laeuft, setLaeuft] = useState(false);

  // Je Kandidat die Drohne bestimmen: erst aus der CSV erraten, sonst die
  // vom Nutzer gewählte Ersatzdrohne.
  const zuordnungen = useMemo(() => {
    if (!vorschau) return new Map<number, string>();
    const m = new Map<number, string>();
    vorschau.kandidaten.forEach((k, i) => {
      const erkannt = passendeDrohne(k.modellText, drohnen);
      m.set(i, erkannt?.id ?? ersatzDrohne);
    });
    return m;
  }, [vorschau, drohnen, ersatzDrohne]);

  const dateiGewaehlt = async (e: ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    if (!datei) return;
    setDateiName(datei.name);
    setLeseFehler(null);
    try {
      const text = await datei.text();
      const v = baueVorschau(text, vorhandeneFluege);
      setVorschau(v);
      // Dubletten standardmäßig abwählen — der häufigste Fall beim
      // wiederholten Import derselben Datei.
      setAbgewaehlt(new Set(v.kandidaten.map((k, i) => (k.dubletteVon ? i : -1)).filter(i => i >= 0)));
    } catch {
      setVorschau(null);
      setLeseFehler('Die Datei konnte nicht gelesen werden.');
    }
  };

  const umschalten = (i: number) => {
    setAbgewaehlt(prev => {
      const neu = new Set(prev);
      if (neu.has(i)) neu.delete(i); else neu.add(i);
      return neu;
    });
  };

  const ausgewaehlt = vorschau
    ? vorschau.kandidaten.filter((_, i) => !abgewaehlt.has(i))
    : [];

  // Ein Kandidat ist nur importierbar, wenn Datum und Drohne stehen.
  const nichtImportierbar = vorschau
    ? vorschau.kandidaten.filter((k, i) => !abgewaehlt.has(i) && (!k.flug.date || !zuordnungen.get(i)))
    : [];

  const importieren = async () => {
    if (!vorschau || ausgewaehlt.length === 0) return;
    setLaeuft(true);
    try {
      let anzahl = 0;
      for (let i = 0; i < vorschau.kandidaten.length; i++) {
        if (abgewaehlt.has(i)) continue;
        const droneId = zuordnungen.get(i);
        const k = vorschau.kandidaten[i];
        if (!droneId || !k.flug.date) continue;
        await dbService.saveFlight(zuFlug(k, droneId));
        anzahl++;
      }
      onImported(anzahl);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-black text-slate-900">Flüge importieren</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Aus Flugaufzeichnung (CSV)</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100" aria-label="Schließen">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">

          {!vorschau && (
            <>
              <label className="block border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center cursor-pointer hover:border-brand-blue/40 transition-colors">
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-700">CSV-Datei auswählen</p>
                <p className="text-[10px] text-slate-400 mt-1">z. B. Export aus Airdata</p>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={dateiGewaehlt} />
              </label>
              {drohnen.length === 0 && (
                <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700">
                    Deine Garage ist noch leer. Lege zuerst eine Drohne an, sonst lassen sich
                    importierte Flüge keinem Gerät zuordnen.
                  </p>
                </div>
              )}
            </>
          )}

          {leseFehler && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl">
              <AlertTriangle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-700">{leseFehler}</p>
            </div>
          )}

          {vorschau && (
            <>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <FileDigit className="w-3.5 h-3.5" />
                <span className="font-bold">{dateiName}</span>
              </div>

              {vorschau.fehler.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-1">
                  {vorschau.fehler.map((f, i) => (
                    <p key={i} className="text-[11px] text-red-700 font-medium">{f}</p>
                  ))}
                </div>
              )}

              {Object.keys(vorschau.zuordnung).length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Erkannte Spalten
                  </p>
                  <div className="space-y-1">
                    {(Object.entries(vorschau.zuordnung) as [string, SpaltenTreffer][]).map(([feld, treffer]) => (
                      <div key={feld} className="flex justify-between gap-2 text-[10px]">
                        <span className="text-slate-500">{feld}</span>
                        <span className="font-bold text-slate-700 truncate">
                          {treffer.spalte}{treffer.einheit ? ' [' + treffer.einheit + ']' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                  {vorschau.nichtZugeordnet.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-200">
                      Ignoriert: {vorschau.nichtZugeordnet.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {vorschau.kandidaten.length > 0 && drohnen.length > 0 && (
                <div className="p-4 bg-white border border-slate-200 rounded-2xl">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Drohne für nicht erkannte Zeilen
                  </label>
                  <select
                    value={ersatzDrohne}
                    onChange={e => setErsatzDrohne(e.target.value)}
                    className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    {drohnen.map(d => (
                      <option key={d.id} value={d.id}>{d.name || d.model}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                {vorschau.kandidaten.map((k, i) => {
                  const aktiv = !abgewaehlt.has(i);
                  const drohne = drohnen.find(d => d.id === zuordnungen.get(i));
                  return (
                    <div
                      key={i}
                      className={cn(
                        'p-3 rounded-2xl border transition-colors',
                        aktiv ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'
                      )}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aktiv}
                          onChange={() => umschalten(i)}
                          className="mt-1 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900">
                              {k.flug.date || 'kein Datum'}
                            </span>
                            {k.flug.startTime && (
                              <span className="text-[10px] font-bold text-slate-500">{k.flug.startTime}</span>
                            )}
                            <span className="text-[10px] font-bold text-brand-blue">{k.flug.duration} Min</span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {k.flug.locationName || 'ohne Ort'} · {drohne ? (drohne.name || drohne.model) : 'keine Drohne'}
                          </p>

                          {k.dubletteVon && (
                            <p className="text-[10px] text-amber-600 font-bold mt-1">
                              Schon im Logbuch, standardmäßig übersprungen.
                            </p>
                          )}
                          {k.hinweise.map((h, j) => (
                            <p key={j} className="text-[10px] text-slate-400 mt-0.5">{h}</p>
                          ))}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>

              {nichtImportierbar.length > 0 && (
                <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700">
                    {nichtImportierbar.length} ausgewählte Zeile(n) haben kein Datum oder keine Drohne
                    und werden übersprungen.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {vorschau && vorschau.kandidaten.length > 0 && (
          <div className="p-5 border-t border-slate-100 shrink-0 flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Abbrechen
            </button>
            <button
              onClick={importieren}
              disabled={ausgewaehlt.length === 0 || laeuft}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-black text-white transition-colors',
                ausgewaehlt.length === 0 || laeuft
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-brand-blue active:scale-[0.98]'
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              {laeuft ? 'Importiere…' : ausgewaehlt.length + ' Flug/Flüge übernehmen'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
