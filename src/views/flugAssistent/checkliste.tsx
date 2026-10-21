import { useState } from 'react';
import { CheckCircle, CheckCircle2, ListChecks, Settings2 } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import { ladeChecklist, punktText, type ChecklistArt, type ChecklistPunkt } from '../../services/checklists';
import { ChecklistEditorDialog } from '../../components/lazyDialogs';

/** Zustand einer anpassbaren Checkliste (Punkte aus dem Editor plus Haken). Liegt
 *  im Assistenten, damit die Vorflug-Liste den Start freigeben kann. */
export function useCheckliste(art: ChecklistArt) {
  const [items, setItems] = useState<ChecklistPunkt[]>(() => ladeChecklist(art));
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const done = items.filter(i => checked[i.id]).length;
  return {
    art, items, checked, done,
    /** Alles abgehakt - eine leere Liste sperrt den Start nicht. */
    vollstaendig: done === items.length,
    toggle: (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] })),
    /** Nach dem Bearbeiten neu laden; unveränderte Punkte behalten ihren Haken. */
    neuLaden: () => {
      const neu = ladeChecklist(art);
      const abgehakt = new Set(items.filter(i => checked[i.id]).map(i => i.text));
      setItems(neu);
      setChecked(Object.fromEntries(neu.filter(i => abgehakt.has(i.text)).map(i => [i.id, true])));
    },
  };
}

export type Checkliste = ReturnType<typeof useCheckliste>;

export function ChecklistKarte({ liste, titel }: { liste: Checkliste, titel: string }) {
  const { tx, sprache } = useSprache();
  const [editor, setEditor] = useState(false);
  const { art, items, checked, done, vollstaendig, toggle, neuLaden } = liste;
  const alleAbgehakt = vollstaendig && items.length > 0;

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-brand-blue" />
          <h3 className="text-sm font-bold text-slate-900">{titel}</h3>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn("text-2xs font-bold px-2 py-0.5 rounded-full", alleAbgehakt ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600")}>
            {done}/{items.length}
          </span>
          <button type="button" onClick={() => setEditor(true)} aria-label={tx('Checkliste bearbeiten', 'Edit checklist')}
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-brand-blue hover:bg-slate-100">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">{tx('Die Liste ist leer – über das Zahnrad Prüfpunkte hinzufügen.', 'The list is empty – add check items via the gear icon.')}</p>
      ) : (
        <div className="space-y-1">
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={!!checked[item.id]}
              onClick={() => toggle(item.id)}
              className="w-full min-h-11 flex items-center gap-3 py-2 text-left active:scale-[0.99] transition-transform"
            >
              {checked[item.id]
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                : <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />}
              <span className={cn("text-sm font-medium", checked[item.id] ? "text-slate-500 line-through" : "text-slate-700")}>{punktText(item, sprache)}</span>
            </button>
          ))}
        </div>
      )}
      {alleAbgehakt && (
        <div className="mt-3 flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl">
          <CheckCircle className="w-4 h-4 text-brand-green shrink-0" />
          <p className="text-xs font-bold text-brand-green">
            {art === 'preflight' ? tx('Alles geprüft – startklar!', 'All checked – ready for take-off!') : tx('Alles erledigt.', 'All done.')}
          </p>
        </div>
      )}

      {editor && (
        <ChecklistEditorDialog
          art={art}
          titel={titel}
          onClose={() => { setEditor(false); neuLaden(); }}
        />
      )}
    </div>
  );
}
