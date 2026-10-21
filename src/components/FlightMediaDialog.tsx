import { useSprache } from '../lib/sprache';
import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Trash2, AlertTriangle, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { dbService, type Flight, type FlightMedia } from '../services/db';
import {
  pruefeDatei, mediaHinzufuegen, mediaEntfernen,
  gesamtGroesse, formatGroesse, MAX_FLUG_BYTES,
} from '../services/flightMedia';
import { bestaetige } from '../services/dialog';
import { Dialog, knopfKlassen } from './ui';
import { useEbene } from '../lib/useEbene';
import { fokusFalle, useDialogFokus } from '../lib/useDialogFokus';

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
  const { tx } = useSprache();
  const [flight, setFlight] = useState<Flight>(initial);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [gross, setGross] = useState<FlightMedia | null>(null);
  // Zurück/Escape schließt zuerst die Bild-Vollansicht, erst dann den Dialog.
  useEbene(!!gross, () => setGross(null));

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
    if (!await bestaetige(tx('Dieses Bild vom Flug entfernen?', 'Remove this photo from the flight?'), { gefaehrlich: true })) return;
    await speichern(mediaEntfernen(media, id));
  };

  return (
    <>
      <Dialog
        titel={tx('Bilder zum Flug', 'Flight photos')}
        untertitel={<>{flight.locationName || 'Flug'} · {new Date(flight.date).toLocaleDateString('de-DE')}</>}
        icon={ImageIcon}
        breite="lg"
        onClose={onClose}
        fuss={
          <div className="w-full space-y-2">
            {/* Datei-Auswahl braucht ein <label> - Knopf-Optik über knopfKlassen. */}
            <label className={cn(knopfKlassen('primaer', 'md', true), laeuft && 'opacity-50')}>
              <ImagePlus className="w-4 h-4" /> {laeuft ? 'Lese…' : 'Bilder hinzufügen'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={hinzufuegen} disabled={laeuft} />
            </label>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{media.length} {media.length === 1 ? 'Bild' : 'Bilder'}</span>
              <span>{formatGroesse(belegt)} {tx('von', 'of')} {formatGroesse(MAX_FLUG_BYTES)}</span>
            </div>
          </div>
        }
      >
        {media.length === 0 ? (
          <div className="text-center py-8">
            <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">{tx('Noch keine Bilder an diesem Flug.', 'No photos attached to this flight yet.')}</p>
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
                  aria-label={tx('Bild entfernen', 'Remove photo')}
                  className="absolute top-1 right-1 p-1.5 rounded-xl bg-slate-900/60 text-white sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {fehler && (
          <p className="text-xs text-brand-red flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {fehler}
          </p>
        )}
      </Dialog>

      {/* Großansicht: bewusst eigene Vollbild-Lightbox (schwarz) über dem Dialog. */}
      {gross && <Grossansicht bild={gross} onClose={() => setGross(null)} />}
    </>
  );
}

/** Foto im Vollbild: eigene Ebene mit Fokus; schließt per Tipp, Escape/Zurück
 *  (useEbene im Dialog oben) oder den Knopf. */
function Grossansicht({ bild, onClose }: { bild: FlightMedia; onClose: () => void }) {
  const { tx } = useSprache();
  const ebene = useRef<HTMLDivElement>(null);
  useDialogFokus(ebene, 'button');
  return (
    <div
      ref={ebene}
      role="dialog"
      aria-modal="true"
      aria-label={bild.name}
      tabIndex={-1}
      onKeyDown={fokusFalle}
      className="fixed inset-0 bg-black/90 z-[90] flex items-center justify-center p-4 focus:outline-none"
      onClick={onClose}
    >
      <img src={bild.dataUrl} alt={bild.name} className="max-w-full max-h-full object-contain rounded-xl" />
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClose(); }}
        aria-label={tx('Großansicht schließen', 'Close full view')}
        className="absolute right-4 p-2 rounded-xl bg-white/15 text-white hover:bg-white/25"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <X className="w-6 h-6" />
      </button>
    </div>
  );
}
