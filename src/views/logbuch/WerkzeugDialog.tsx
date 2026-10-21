import { Download, FileDigit, MapPin, TrendingUp, Upload } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { Abschnitt, Dialog, Feld, eingabe } from '../../components/ui';

function WerkzeugZeile({ icon: Icon, titel, text, onClick }: { icon: typeof FileDigit; titel: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-left"
    >
      <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-200">
        <Icon className="w-4 h-4 text-brand-blue" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{titel}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </button>
  );
}

/** Export, Import und Statistik - hinter dem „⋯“-Knopf des Logbuchs. */
export function WerkzeugDialog({ jahre, exportJahr, setExportJahr, onStatistik, onPdf, onCsv, onKml, onImport, onClose }: {
  /** Jahre, aus denen Flüge vorliegen (für den PDF-Zeitraum). */
  jahre: string[];
  exportJahr: string;
  setExportJahr: (j: string) => void;
  onStatistik: () => void;
  onPdf: () => void;
  onCsv: () => void;
  onKml: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const { tx } = useSprache();
  return (
    <Dialog titel={tx('Export, Import & Statistik', 'Export, import & statistics')} icon={FileDigit} onClose={onClose}>
      <div className="space-y-2">
        <Abschnitt titel={tx('Auswerten', 'Analyse')} />
        <WerkzeugZeile icon={TrendingUp} titel={tx('Statistik', 'Statistics')} text={tx('Flugzeit je Monat, Drohne und Zweck', 'Flight time per month, drone and purpose')} onClick={onStatistik} />
      </div>
      <div className="space-y-2">
        <Abschnitt titel={tx('Exportieren', 'Export')} />
        {jahre.length > 0 && (
          <Feld label={tx('Zeitraum für den PDF-Nachweis', 'Period for the PDF record')} htmlFor="lb-jahr">
            <select id="lb-jahr" value={exportJahr} onChange={e => setExportJahr(e.target.value)} className={eingabe}>
              <option value="alle">{tx('Alle Jahre', 'All years')}</option>
              {jahre.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </Feld>
        )}
        <WerkzeugZeile icon={FileDigit} titel={tx('PDF-Betriebsnachweis', 'PDF operations record')} text={tx('Flugbuch mit Summen zum Vorzeigen', 'Logbook with totals to show')} onClick={onPdf} />
        <WerkzeugZeile icon={Download} titel={tx('CSV-Tabelle', 'CSV table')} text={tx('Für Excel oder Numbers', 'For Excel or Numbers')} onClick={onCsv} />
        <WerkzeugZeile icon={MapPin} titel={tx('KML für Google Earth', 'KML for Google Earth')} text={tx('Alle Flugorte auf der Karte', 'All flight locations on a map')} onClick={onKml} />
      </div>
      <div className="space-y-2">
        <Abschnitt titel={tx('Importieren', 'Import')} />
        <WerkzeugZeile icon={Upload} titel={tx('Flüge importieren', 'Import flights')} text={tx('Airdata-CSV oder DJI-SRT', 'Airdata CSV or DJI SRT')} onClick={onImport} />
      </div>
    </Dialog>
  );
}
