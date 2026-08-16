import { useState, useRef, useEffect, type FormEvent } from 'react';
import { X, Search, MapPin, Crosshair, AlertCircle, Loader2 } from 'lucide-react';
import { sucheOrte, parseKoordinaten, type OrtsTreffer } from '../services/geocode';

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
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-blue" />
            <h3 className="font-black text-slate-900">Standort setzen</h3>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Ortssuche */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ort suchen</p>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm focus:outline-none"
                placeholder="z. B. Offenburg, Flugplatz Griesheim …"
                value={suche}
                onChange={e => setSuche(e.target.value)}
              />
              {laedt && <Loader2 className="w-4 h-4 text-slate-300 animate-spin shrink-0" />}
            </div>

            {suche.trim().length >= 2 && !laedt && treffer.length === 0 && (
              <p className="text-xs text-slate-400 py-2 text-center">Keine Treffer.</p>
            )}
            {treffer.map((t, i) => (
              <button
                key={i}
                onClick={() => onPick(t.lat, t.lon, t.name)}
                className="w-full flex items-start gap-2 bg-white rounded-xl border border-slate-200 p-3 text-left active:scale-[.99]"
              >
                <MapPin className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-snug">{t.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{t.lat.toFixed(5)}, {t.lon.toFixed(5)}</p>
                </div>
              </button>
            ))}
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Ortssuche über OpenStreetMap (Nominatim). Benötigt eine Internetverbindung.
            </p>
          </div>

          {/* Koordinaten von Hand */}
          <form onSubmit={koordUebernehmen} className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Oder Koordinaten eingeben</p>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
              <Crosshair className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                className="flex-1 bg-transparent text-sm font-mono focus:outline-none"
                placeholder="52.5200, 13.4050"
                value={koordText}
                onChange={e => { setKoordText(e.target.value); setFehler(''); }}
              />
            </div>
            {fehler && (
              <p className="text-[11px] text-brand-red flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fehler}
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-brand-blue text-white font-bold py-2.5 rounded-xl text-sm active:scale-95"
            >
              Standort übernehmen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
