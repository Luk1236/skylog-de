import { useSyncExternalStore } from 'react';
import { Undo2, X } from 'lucide-react';
import { abonniereHinweis, aktuellerHinweis, fuehreRueckgaengigAus, schliesseHinweis } from '../services/rueckgaengig';
import { useSprache } from '../lib/sprache';

/** Leiste „… gelöscht – Rückgängig“ über der unteren Navigation. */
export function HinweisLeiste() {
  const { tx } = useSprache();
  const hinweis = useSyncExternalStore(abonniereHinweis, aktuellerHinweis, aktuellerHinweis);
  if (!hinweis) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 z-[95] w-[calc(100%-2rem)] max-w-sm bg-slate-900 text-white rounded-2xl shadow-2xl pl-4 pr-1 py-1 flex items-center gap-2"
    >
      <p className="flex-1 text-sm font-medium">{hinweis.text}</p>
      <button
        type="button"
        onClick={() => void fuehreRueckgaengigAus()}
        className="h-10 px-3 rounded-xl text-sm font-bold text-blue-200 hover:bg-white/10 flex items-center gap-1.5"
      >
        <Undo2 className="w-4 h-4" /> {tx('Rückgängig', 'Undo')}
      </button>
      <button
        type="button"
        onClick={schliesseHinweis}
        aria-label={tx('Hinweis schließen', 'Close notice')}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
