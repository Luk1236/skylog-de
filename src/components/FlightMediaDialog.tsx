import { useState, type ChangeEvent } from 'react';
import { X, ImagePlus, Trash2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { dbService, type Flight, type FlightMedia } from '../services/db';
import {
  pruefeDatei, mediaHinzufuegen, mediaEntfernen,
  gesamtGroesse, formatGroesse, MAX_FLUG_BYTES,
} from '../services/flightMedia';
import { bestaetige } from '../services/dialog';

interface Props {
  flight: Flight;
  onClose: () => void;
  onUpdate: () => void;
}

// Datei als Data-URL einlesen — so hängt das Bild direkt am Flug und wandert
// mit der Sicherung mit.
function alsDataUrl(datei: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(datei);
  });
}

export function FlightMediaDialog({ flight: initial, onClose, onUpdate }: Props) {
  const [flight, setFlight] = useState<Flight>(initial);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [gross, setGross] = useState<FlightMedia | null>(null);

  const media = flight.media ?? [];
  const belegt = gesamtGroesse(media);

  const speichern = async (neueListe: FlightMedia[]) => {
    const aktualisiert: Flight = { ...flight, media: neueListe };
    await dbService.saveFlight(aktualisiert);
    setFlight(aktualisiert);
    onUpdate();
  };

  const hinzufuegen = async (e: ChangeEvent<HTMLInputElement>) => {
    const dateien: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (dateien.length === 0) return;
    setFehler(null);
    setLaeuft(true);
    try {
      let liste = media;
      for (const datei of dateien) {
        const pruefung = pruefeDatei(datei, liste);
        if (!pruefung.ok) { setFehler(pruefung.fehler ?? 'Datei abgelehnt.'); break; }
        liste = mediaHinzufuegen(liste, {
          id: crypto.randomUUID(),
          name: datei.name,
          type: datei.type,
          dataUrl: await alsDataUrl(datei),
          size: datei.size,
          addedAt: Date.now(),
        });
      }
      if (liste !== media) await speichern(liste);
    } catch {
      setFehler('Bild konnte nicht gelesen werden.');
    } finally {
      setLaeuft(false);
    }
  };

  const entfernen = async (id: string) => {
    if (!await bestaetige('Dieses Bild vom Flug entfernen?', { gefaehrlich: true })) return;
    await speichern(mediaEntfernen(media, id));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-brand-blue" />
            <h3 className="font-black text-slate-900">Bilder zum Flug</h3>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-[10px] text-slate-400">
            {flight.locationName || 'Flug'} · {new Date(flight.date).toLocaleDateString('de-DE')}
          </p>

          {media.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Noch keine Bilder an diesem Flug.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {media.map(m => (
                <div key={m.id} className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-white">
                  <img
                    src={m.dataUrl}
                    alt={m.name}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setGross(m)}
                  />
                  <button
                    onClick={() => entfernen(m.id)}
                    aria-label="Bild entfernen"
                    className="absolute top-1 right-1 p-1 rounded-lg bg-slate-900/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {fehler && (
            <p className="text-[11px] text-brand-red flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {fehler}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 shrink-0 bg-white sm:rounded-b-3xl space-y-2">
          <label className={cn(
            'w-full flex items-center justify-center gap-2 bg-brand-blue text-white font-bold py-3 rounded-xl text-sm cursor-pointer active:scale-95 transition-all',
            laeuft && 'opacity-60'
          )}>
            <ImagePlus className="w-4 h-4" /> {laeuft ? 'Lese…' : 'Bilder hinzufügen'}
            <input type="file" accept="image/*" multiple className="hidden" onChange={hinzufuegen} disabled={laeuft} />
          </label>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>{media.length} {media.length === 1 ? 'Bild' : 'Bilder'}</span>
            <span>{formatGroesse(belegt)} von {formatGroesse(MAX_FLUG_BYTES)}</span>
          </div>
        </div>
      </div>

      {/* Großansicht */}
      {gross && (
        <div className="fixed inset-0 bg-black/90 z-[90] flex items-center justify-center p-4" onClick={() => setGross(null)}>
          <img src={gross.dataUrl} alt={gross.name} className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
