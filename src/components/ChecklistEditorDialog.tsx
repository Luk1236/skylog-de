import { useState } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import {
  ladeChecklist, speichereChecklist, setzeZurueck,
  punktHinzufuegen, punktEntfernen, punktBearbeiten, verschiebe,
  type ChecklistArt, type ChecklistPunkt,
} from '../services/checklists';
import { bestaetige } from '../services/dialog';

interface Props {
  art: ChecklistArt;
  titel: string;
  onClose: () => void;
}

export function ChecklistEditorDialog({ art, titel, onClose }: Props) {
  const [punkte, setPunkte] = useState<ChecklistPunkt[]>(() => ladeChecklist(art));
  const [neu, setNeu] = useState('');

  // Jede Änderung sofort persistieren — kein separater Speichern-Schritt nötig.
  const anwenden = (liste: ChecklistPunkt[]) => {
    setPunkte(liste);
    speichereChecklist(art, liste);
  };

  const hinzufuegen = () => {
    const l = punktHinzufuegen(punkte, neu);
    if (l !== punkte) { anwenden(l); setNeu(''); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[80] flex items-end sm:items-center justify-center">
      <div className="bg-slate-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 bg-white sm:rounded-t-3xl">
          <h3 className="font-black text-slate-900">{titel} bearbeiten</h3>
          <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-2">
          {punkte.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-2">
              <input
                className="flex-1 bg-transparent text-sm outline-none px-1"
                value={p.text}
                onChange={e => anwenden(punktBearbeiten(punkte, p.id, e.target.value))}
              />
              <button onClick={() => anwenden(verschiebe(punkte, p.id, -1))} disabled={i === 0}
                aria-label="Nach oben" className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-30">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={() => anwenden(verschiebe(punkte, p.id, 1))} disabled={i === punkte.length - 1}
                aria-label="Nach unten" className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-30">
                <ChevronDown className="w-4 h-4" />
              </button>
              <button onClick={() => anwenden(punktEntfernen(punkte, p.id))}
                aria-label="Löschen" className="p-1 text-slate-300 hover:text-brand-red">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {punkte.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">Keine Punkte — füge unten welche hinzu.</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 shrink-0 space-y-2 bg-white sm:rounded-b-3xl">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder="Neuer Prüfpunkt…"
              value={neu}
              onChange={e => setNeu(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') hinzufuegen(); }}
            />
            <button onClick={hinzufuegen} className="bg-brand-blue text-white px-4 rounded-xl active:scale-95">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={async () => { if (await bestaetige('Diese Liste auf die Standardpunkte zurücksetzen?')) anwenden(setzeZurueck(art)); }}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl py-2"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Auf Standard zurücksetzen
          </button>
        </div>
      </div>
    </div>
  );
}
