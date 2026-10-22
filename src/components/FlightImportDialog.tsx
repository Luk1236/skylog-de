import { useSprache } from '../lib/sprache';
import { useState, useMemo, type ChangeEvent } from 'react';
import { Upload, AlertTriangle, CheckCircle2, Info, FileDigit } from 'lucide-react';
import { cn } from '../lib/utils';
import { dbService, type Drone, type Flight } from '../services/db';
import {
  baueVorschau,
  passendeDrohne,
  zuFlug,
  type ImportVorschau,
  type SpaltenTreffer,
} from '../services/flightImport';
import { baueVorschauAusSrt, istSrt } from '../services/djiSrt';
import { Dialog, Knopf, Feld, eingabe, Abschnitt } from './ui';

interface Props {
  drohnen: Drone[];
  vorhandeneFluege: Flight[];
  onClose: () => void;
  /** Wird nach erfolgreichem Import aufgerufen, damit die Liste neu lädt. */
  onImported: (anzahl: number) => void;
}

export function FlightImportDialog({ drohnen, vorhandeneFluege, onClose, onImported }: Props) {
  const { tx } = useSprache();
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
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const dateien: File[] = Array.from(fileList);
    setDateiName(dateien.length === 1 ? dateien[0].name : tx(`${dateien.length} Dateien`, `${dateien.length} files`));
    setLeseFehler(null);
    try {
      // Jede Datei einzeln parsen (CSV/SRT gemischt möglich) und die Kandidaten
      // zu einer gemeinsamen Vorschau bündeln. Die Spaltenzuordnung stammt von
      // der ersten CSV-Datei; bei reinen SRT-Importen bleibt sie leer.
      const teile = await Promise.all(dateien.map(async d => {
        const text = await d.text();
        const v = istSrt(d.name, text)
          ? baueVorschauAusSrt(text, vorhandeneFluege)
          : baueVorschau(text, vorhandeneFluege);
        return { name: d.name, v };
      }));

      const kandidaten = teile.flatMap(t => t.v.kandidaten);
      const fehler = teile.flatMap(t =>
        t.v.fehler.map(f => (dateien.length > 1 ? `${t.name}: ${f}` : f)));
      const ersteMitSpalten = teile.find(t => Object.keys(t.v.zuordnung).length > 0)?.v;

      const v: ImportVorschau = {
        kandidaten,
        fehler,
        zuordnung: ersteMitSpalten?.zuordnung ?? {},
        nichtZugeordnet: ersteMitSpalten?.nichtZugeordnet ?? [],
      };
      setVorschau(v);
      // Dubletten standardmäßig abwählen — der häufigste Fall beim
      // wiederholten Import derselben Datei.
      setAbgewaehlt(new Set(kandidaten.map((k, i) => (k.dubletteVon ? i : -1)).filter(i => i >= 0)));
    } catch {
      setVorschau(null);
      setLeseFehler('Mindestens eine Datei konnte nicht gelesen werden.');
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
    <Dialog
      titel={tx('Flüge importieren', 'Import flights')}
      untertitel={tx('Aus Flugaufzeichnung (CSV oder DJI-SRT)', 'From a flight log (CSV or DJI SRT)')}
      icon={Upload}
      breite={vorschau ? 'xxl' : 'lg'}
      onClose={onClose}
      fuss={vorschau && vorschau.kandidaten.length > 0 ? (
        <>
          <Knopf variante="sekundaer" onClick={onClose}>
            {tx('Abbrechen', 'Cancel')}
          </Knopf>
          <Knopf
            className="flex-1"
            icon={CheckCircle2}
            onClick={importieren}
            disabled={ausgewaehlt.length === 0 || laeuft}
          >
            {laeuft ? tx('Importiere…', 'Importing…') : tx(`${ausgewaehlt.length} Flug/Flüge übernehmen`, `Import ${ausgewaehlt.length} flight(s)`)}
          </Knopf>
        </>
      ) : undefined}
    >
      {!vorschau && (
        <>
          <label className="block border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center cursor-pointer hover:border-brand-blue/40 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-900">{tx('Dateien auswählen', 'Choose files')}</p>
            <p className="text-xs text-slate-500 mt-1">{tx('Eine oder mehrere · CSV (Airdata UAV, DJI Fly) oder DJI-SRT', 'One or more · CSV (Airdata UAV, DJI Fly) or DJI SRT')}</p>
            <input type="file" multiple accept=".csv,text/csv,.srt,application/x-subrip" className="hidden" onChange={dateiGewaehlt} />
          </label>
          {drohnen.length === 0 && (
            <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                {tx('Deine Garage ist noch leer. Lege zuerst eine Drohne an, sonst lassen sich importierte Flüge keinem Gerät zuordnen.', 'Your fleet is still empty. Add a drone first, otherwise imported flights cannot be assigned to an aircraft.')}
              </p>
            </div>
          )}
        </>
      )}

      {leseFehler && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl">
          <AlertTriangle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{leseFehler}</p>
        </div>
      )}

      {vorschau && (
        // Am Laptop zweispaltig: Datei, erkannte Spalten und Drohne links, Flüge rechts
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <FileDigit className="w-4 h-4" />
              <span className="font-bold">{dateiName}</span>
            </div>

            {vorschau.fehler.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-1">
                {vorschau.fehler.map((f, i) => (
                  <p key={i} className="text-xs text-red-700 font-medium">{f}</p>
                ))}
              </div>
            )}

            {Object.keys(vorschau.zuordnung).length > 0 && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <Abschnitt titel={tx('Erkannte Spalten', 'Detected columns')} />
                <div className="space-y-1">
                  {(Object.entries(vorschau.zuordnung) as [string, SpaltenTreffer][]).map(([feld, treffer]) => (
                    <div key={feld} className="flex justify-between gap-2 text-xs">
                      <span className="text-slate-500">{feld}</span>
                      <span className="font-bold text-slate-700 truncate">
                        {treffer.spalte}{treffer.einheit ? ' [' + treffer.einheit + ']' : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {vorschau.nichtZugeordnet.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
                    {tx('Ignoriert:', 'Ignored:')} {vorschau.nichtZugeordnet.join(', ')}
                  </p>
                )}
              </div>
            )}

            {vorschau.kandidaten.length > 0 && drohnen.length > 0 && (
              <Feld label={tx('Drohne für nicht erkannte Zeilen', 'Drone for unrecognised rows')} htmlFor="import-ersatz-drohne">
                <select
                  id="import-ersatz-drohne"
                  value={ersatzDrohne}
                  onChange={e => setErsatzDrohne(e.target.value)}
                  className={eingabe}
                >
                  {drohnen.map(d => (
                    <option key={d.id} value={d.id}>{d.name || d.model}</option>
                  ))}
                </select>
              </Feld>
            )}
          </div>
          <div className="space-y-4">
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
                        className="mt-0.5 w-4 h-4 shrink-0 accent-brand-blue"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">
                            {k.flug.date || tx('kein Datum', 'no date')}
                          </span>
                          {k.flug.startTime && (
                            <span className="text-xs font-bold text-slate-500">{k.flug.startTime}</span>
                          )}
                          <span className="text-xs font-bold text-brand-blue">{k.flug.duration} min</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {k.flug.locationName || tx('ohne Ort', 'no location')} · {drohne ? (drohne.name || drohne.model) : tx('keine Drohne', 'no drone')}
                        </p>

                        {k.dubletteVon && (
                          <p className="text-xs text-amber-800 font-bold mt-1">
                            {tx('Schon im Logbuch, standardmäßig übersprungen.', 'Already in the logbook, skipped by default.')}
                          </p>
                        )}
                        {k.hinweise.map((h, j) => (
                          <p key={j} className="text-2xs text-slate-500 mt-0.5">{h}</p>
                        ))}
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>

            {nichtImportierbar.length > 0 && (
              <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  {nichtImportierbar.length} {tx('ausgewählte Zeile(n) haben kein Datum oder keine Drohne und werden übersprungen.', 'selected row(s) have no date or drone and will be skipped.')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
