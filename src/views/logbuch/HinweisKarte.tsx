import { useState } from 'react';
import { Bell, BellOff, ChevronDown } from 'lucide-react';
import { useSprache } from '../../lib/sprache';
import { cn } from '../../lib/utils';
import type { Reminder } from '../../services/reminders';
import { Knopf } from '../../components/ui';

/** Erinnerungen als eine aufklappbare Karte statt eines Banner-Stapels. */
export function HinweisKarte({ hinweise, onAusblenden }: {
  /** Sichtbare Erinnerungen, dringende zuerst. */
  hinweise: Reminder[];
  /** „In 7 Tagen erinnern“. */
  onAusblenden: (schluessel: string) => void;
}) {
  const { tx, sprache } = useSprache();
  const [offen, setOffen] = useState(false);
  if (hinweise.length === 0) return null;

  const text = (h: Reminder) => (sprache === 'en' ? h.textEn : h.text);
  const alarm = hinweise.some(h => h.level === 'alert');

  return (
    <div className="mb-6 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        aria-expanded={offen}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', alarm ? 'bg-red-50 text-brand-red' : 'bg-amber-50 text-amber-800')}>
          <Bell className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-slate-900">
            {hinweise.length === 1 ? tx('1 Hinweis', '1 reminder') : `${hinweise.length} ${tx('Hinweise', 'reminders')}`}
          </span>
          <span className={cn('block text-xs text-slate-600', !offen && 'truncate')}>{text(hinweise[0])}</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-slate-500 shrink-0 transition-transform', offen && 'rotate-180')} />
      </button>
      {offen && (
        <ul className="border-t border-slate-200 divide-y divide-slate-200">
          {hinweise.map(h => (
            <li key={h.schluessel} className="flex items-start gap-3 px-4 py-3">
              <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', h.level === 'alert' ? 'bg-brand-red' : 'bg-amber-500')} />
              <p className="flex-1 text-sm text-slate-700">{text(h)}</p>
              <Knopf variante="geist" groesse="sm" icon={BellOff} className="shrink-0 -my-1" onClick={() => onAusblenden(h.schluessel)}>
                {tx('In 7 Tagen', 'In 7 days')}
              </Knopf>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
