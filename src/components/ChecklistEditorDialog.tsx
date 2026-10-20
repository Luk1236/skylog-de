import { useSprache } from '../lib/sprache';
import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, RotateCcw, ListChecks } from 'lucide-react';
import {
  ladeChecklist, speichereChecklist, setzeZurueck,
  punktHinzufuegen, punktEntfernen, punktBearbeiten, verschiebe,
  type ChecklistArt, type ChecklistPunkt,
} from '../services/checklists';
import { bestaetige } from '../services/dialog';
import { Dialog, Knopf, eingabe } from './ui';

interface Props {
  art: ChecklistArt;
  titel: string;
  onClose: () => void;
}

export function ChecklistEditorDialog({ art, titel, onClose }: Props) {
  const { tx } = useSprache();
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
    <Dialog
      titel={<>{titel} {tx('bearbeiten', 'edit')}</>}
      icon={ListChecks}
      breite="md"
      onClose={onClose}
      fuss={
        <div className="w-full space-y-2">
          <div className="flex gap-2">
            <input
              className={eingabe}
              placeholder={tx('Neuer Prüfpunkt…', 'New check item…')}
              value={neu}
              onChange={e => setNeu(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') hinzufuegen(); }}
            />
            <Knopf icon={Plus} onClick={hinzufuegen} aria-label={tx('Hinzufügen', 'Add')} className="shrink-0" />
          </div>
          <Knopf
            variante="geist"
            groesse="sm"
            voll
            icon={RotateCcw}
            onClick={async () => { if (await bestaetige(tx('Diese Liste auf die Standardpunkte zurücksetzen?', 'Reset this list to the default items?'))) anwenden(setzeZurueck(art)); }}
          >
            {tx('Auf Standard zurücksetzen', 'Reset to default')}
          </Knopf>
        </div>
      }
    >
      <div className="space-y-2">
        {punkte.map((p, i) => (
          <div key={p.id} className="flex items-center gap-1 bg-white rounded-2xl border border-slate-200 p-1.5 pl-3">
            <input
              className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 rounded-xl px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              value={p.text}
              onChange={e => anwenden(punktBearbeiten(punkte, p.id, e.target.value))}
            />
            <button onClick={() => anwenden(verschiebe(punkte, p.id, -1))} disabled={i === 0}
              aria-label={tx('Nach oben', 'Move up')} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button onClick={() => anwenden(verschiebe(punkte, p.id, 1))} disabled={i === punkte.length - 1}
              aria-label={tx('Nach unten', 'Move down')} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
              <ChevronDown className="w-4 h-4" />
            </button>
            <button onClick={() => anwenden(punktEntfernen(punkte, p.id))}
              aria-label={tx('Löschen', 'Delete')} className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-brand-red">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {punkte.length === 0 && (
          <p className="text-center text-xs text-slate-500 py-6">{tx('Keine Punkte — füge unten welche hinzu.', 'No items — add some below.')}</p>
        )}
      </div>
    </Dialog>
  );
}
