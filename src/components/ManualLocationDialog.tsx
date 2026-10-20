import { useSprache } from '../lib/sprache';
import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Search, MapPin, Crosshair, AlertCircle, Loader2 } from 'lucide-react';
import { sucheOrte, parseKoordinaten, type OrtsTreffer } from '../services/geocode';
import { cn } from '../lib/utils';
import { Dialog, Knopf, Feld, eingabe } from './ui';

interface Props {
  /** Startwert für die Koordinatenanzeige (aktueller Kartenmittelpunkt). */
  aktuell: [number, number];
  /** Wird mit dem gewählten Ort aufgerufen. name ist ggf. leer. */
  onPick: (lat: number, lon: number, name: string) => void;
  onClose: () => void;
}

/** Standort ohne GPS setzen: per Ortssuche oder per Koordinateneingabe.
 *  Nützlich am Desktop und wenn die Standortfreigabe verweigert wurde. */
export function ManualLocationDialog({ aktuell, onPick, onClose }: Props) {
  const { tx } = useSprache();
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<OrtsTreffer[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [koordText, setKoordText] = useState(`${aktuell[0].toFixed(5)}, ${aktuell[1].toFixed(5)}`);
  const [fehler, setFehler] = useState('');
  const abbrechen = useRef<AbortController | null>(null);

  // Ortssuche mit kurzer Verzögerung, damit nicht jeder Tastendruck eine
  // Anfrage auslöst. Laufende Anfragen werden abgebrochen.
  useEffect(() => {
    const q = suche.trim();
    if (q.length < 2) { setTreffer([]); setLaedt(false); return; }

    const timer = setTimeout(async () => {
      abbrechen.current?.abort();
      const ctrl = new AbortController();
      abbrechen.current = ctrl;
      setLaedt(true);
      const res = await sucheOrte(q, ctrl.signal);
      if (!ctrl.signal.aborted) { setTreffer(res); setLaedt(false); }
    }, 450);

    return () => clearTimeout(timer);
  }, [suche]);

  const koordUebernehmen = (e: FormEvent) => {
    e.preventDefault();
    const paar = parseKoordinaten(koordText);
    if (!paar) {
      setFehler('Koordinaten nicht erkannt. Beispiel: 52.5200, 13.4050');
      return;
    }
    onPick(paar[0], paar[1], '');
  };

  return (
    <Dialog
      titel={tx('Standort setzen', 'Set location')}
      icon={MapPin}
      breite="md"
      onClose={onClose}
    >
      {/* Ortssuche */}
      <div className="space-y-2">
        <Feld label={tx('Ort suchen', 'Search place')} htmlFor="standort-suche">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="standort-suche"
              autoFocus
              className={cn(eingabe, 'pl-9 pr-9')}
              placeholder={tx('z. B. Offenburg, Flugplatz Griesheim …', 'e.g. Offenburg, Griesheim airfield …')}
              value={suche}
              onChange={e => setSuche(e.target.value)}
            />
            {laedt && <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
          </div>
        </Feld>

        {suche.trim().length >= 2 && !laedt && treffer.length === 0 && (
          <p className="text-xs text-slate-500 py-2 text-center">{tx('Keine Treffer.', 'No results.')}</p>
        )}
        {treffer.map((t, i) => (
          <button
            key={i}
            onClick={() => onPick(t.lat, t.lon, t.name)}
            className="w-full flex items-start gap-2 bg-white rounded-2xl border border-slate-200 p-3 text-left hover:border-brand-blue/40 active:scale-[.99]"
          >
            <MapPin className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 leading-snug">{t.name}</p>
              <p className="text-xs text-slate-500 font-mono">{t.lat.toFixed(5)}, {t.lon.toFixed(5)}</p>
            </div>
          </button>
        ))}
        <p className="text-xs text-slate-500 leading-relaxed">
          {tx('Ortssuche über OpenStreetMap (Nominatim). Benötigt eine Internetverbindung.', 'Place search via OpenStreetMap (Nominatim). Requires an internet connection.')}
        </p>
      </div>

      {/* Koordinaten von Hand */}
      <form onSubmit={koordUebernehmen} className="space-y-2 border-t border-slate-100 pt-4">
        <Feld
          label={tx('Oder Koordinaten eingeben', 'Or enter coordinates')}
          htmlFor="standort-koordinaten"
          fehler={fehler ? (
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fehler}
            </span>
          ) : undefined}
        >
          <div className="relative">
            <Crosshair className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="standort-koordinaten"
              className={cn(eingabe, 'pl-9 font-mono')}
              placeholder="52.5200, 13.4050"
              value={koordText}
              onChange={e => { setKoordText(e.target.value); setFehler(''); }}
            />
          </div>
        </Feld>
        <Knopf type="submit" voll>
          {tx('Standort übernehmen', 'Use location')}
        </Knopf>
      </form>
    </Dialog>
  );
}
