import { ChevronRight, Languages, LayoutGrid, Moon, Sun, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSprache } from '../lib/sprache';
import type { View } from '../lib/ansichten';
import type { Theme } from '../services/theme';
import type { Sprache } from '../services/i18n';
import { Dialog } from './ui';

/** Ein Menüpunkt: öffnet entweder eine Ansicht oder einen Dialog. */
export interface MenueEintrag {
  id: string;
  icon: LucideIcon;
  label: string;
  view?: View;
  oeffnen?: () => void;
}

/** Menügruppen folgen dem Ablauf: vor dem Flug, nach dem Flug, Verwaltung,
 *  Wissen & Konto. Vorher lagen die Werkzeuge an vier verschiedenen Orten. */
export interface MenueGruppe {
  titel: string;
  eintraege: MenueEintrag[];
}

interface Einstellungen {
  theme: Theme;
  sprache: Sprache;
  onTheme: () => void;
  onSprache: () => void;
}

/** Das „Mehr“-Blatt (Handy): alle Werkzeuge und selteneren Ansichten, gruppiert. */
export function MehrSheet({ gruppen, activeView, onWaehle, onClose, theme, sprache, onTheme, onSprache }: {
  gruppen: MenueGruppe[];
  activeView: View;
  onWaehle: (eintrag: MenueEintrag) => void;
  onClose: () => void;
} & Einstellungen) {
  const { t } = useSprache();
  return (
    <Dialog titel={t('nav.mehr')} icon={LayoutGrid} onClose={onClose}>
      {gruppen.map(g => (
        <section key={g.titel}>
          <h3 className="text-2xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5">{g.titel}</h3>
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden">
            {g.eintraege.map(e => {
              const aktiv = !!e.view && e.view === activeView;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onWaehle(e)}
                  className={cn('w-full flex items-center gap-3 px-4 h-12 text-left transition-colors', aktiv ? 'bg-brand-blue/10' : 'hover:bg-slate-50')}
                >
                  <e.icon className={cn('w-5 h-5 shrink-0', aktiv ? 'text-brand-blue' : 'text-slate-500')} />
                  <span className={cn('text-sm font-bold flex-1', aktiv ? 'text-brand-blue' : 'text-slate-800')}>{e.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <SchnellEinstellungen theme={theme} sprache={sprache} onTheme={onTheme} onSprache={onSprache} />
    </Dialog>
  );
}

/** Dieselben Gruppen in der Seitenleiste (Laptop). */
export function SeitenleistenMenue({ gruppen, activeView, onWaehle, theme, sprache, onTheme, onSprache }: {
  gruppen: MenueGruppe[];
  activeView: View;
  onWaehle: (eintrag: MenueEintrag) => void;
} & Einstellungen) {
  const { t } = useSprache();
  return (
    <div className="hidden lg:block mt-3 pt-1 border-t border-slate-200">
      {gruppen.map(g => (
        <div key={g.titel}>
          <p className="px-4 pt-4 pb-1 text-2xs font-bold text-slate-500 uppercase tracking-wider">{g.titel}</p>
          {g.eintraege.map(e => {
            const aktiv = !!e.view && e.view === activeView;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onWaehle(e)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 rounded-xl text-left text-sm font-bold transition-colors',
                  aktiv ? 'bg-brand-blue/10 text-brand-blue' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <e.icon className={cn('w-4 h-4 shrink-0', aktiv ? 'text-brand-blue' : 'text-slate-500')} />
                <span className="truncate">{e.label}</span>
              </button>
            );
          })}
        </div>
      ))}
      <p className="px-4 pt-4 pb-1 text-2xs font-bold text-slate-500 uppercase tracking-wider">{t('mehr.einstellungen')}</p>
      <button type="button" onClick={onSprache} className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-left text-sm font-bold text-slate-600 hover:bg-slate-50">
        <Languages className="w-4 h-4 shrink-0 text-slate-500" />
        <span className="flex-1">{t('mehr.sprache')}</span>
        <span className="text-xs font-black text-brand-blue">{sprache.toUpperCase()}</span>
      </button>
      <button type="button" onClick={onTheme} className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-left text-sm font-bold text-slate-600 hover:bg-slate-50">
        {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0 text-slate-500" /> : <Moon className="w-4 h-4 shrink-0 text-slate-500" />}
        <span className="flex-1">{t('mehr.design')}</span>
        <span className="text-xs font-bold text-slate-500">{theme === 'dark' ? t('mehr.dunkel') : t('mehr.hell')}</span>
      </button>
    </div>
  );
}

function SchnellEinstellungen({ theme, sprache, onTheme, onSprache }: Einstellungen) {
  const { t } = useSprache();
  return (
    <section>
      <h3 className="text-2xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-1.5">{t('mehr.einstellungen')}</h3>
      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden">
        <button type="button" onClick={onSprache} className="w-full flex items-center gap-3 px-4 h-12 text-left hover:bg-slate-50 transition-colors">
          <Languages className="w-5 h-5 shrink-0 text-slate-500" />
          <span className="text-sm font-bold flex-1 text-slate-800">{t('mehr.sprache')}</span>
          <span className="text-xs font-black text-brand-blue tracking-wider">{sprache.toUpperCase()}</span>
        </button>
        <button type="button" onClick={onTheme} className="w-full flex items-center gap-3 px-4 h-12 text-left hover:bg-slate-50 transition-colors">
          {theme === 'dark' ? <Sun className="w-5 h-5 shrink-0 text-slate-500" /> : <Moon className="w-5 h-5 shrink-0 text-slate-500" />}
          <span className="text-sm font-bold flex-1 text-slate-800">{t('mehr.design')}</span>
          <span className="text-xs font-bold text-slate-500">{theme === 'dark' ? t('mehr.dunkel') : t('mehr.hell')}</span>
        </button>
      </div>
    </section>
  );
}

/** Ein Punkt der Hauptnavigation (unten auf dem Handy, links auf dem Laptop). */
export function NavButton({ active, onClick, icon: Icon, label, badge, className }: { active: boolean, onClick: () => void, icon: LucideIcon, label: string, badge?: number, className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        className,
        'flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-2xl transition-all duration-200 touch-shrink relative min-w-0',
        'lg:flex-row lg:justify-start lg:gap-3 lg:w-full lg:px-4 lg:py-2.5 lg:rounded-xl',
        active ? 'text-brand-blue lg:bg-brand-blue/10' : 'text-slate-500 hover:text-slate-700 lg:hover:bg-slate-50',
      )}
    >
      {active && (
        <span className="absolute -top-1 w-6 h-1 bg-brand-blue rounded-full lg:top-1/2 lg:-translate-y-1/2 lg:left-0 lg:w-1 lg:h-7" />
      )}
      <div className={cn('p-1.5 rounded-xl transition-all duration-200 relative', active ? 'bg-brand-blue/10' : 'bg-transparent')}>
        <Icon className={cn('w-5 h-5', active ? 'stroke-[2.5px]' : 'stroke-[1.75px]')} />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-brand-red text-white text-2xs font-black rounded-full flex items-center justify-center px-1 leading-none border border-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-2xs lg:text-sm font-bold truncate max-w-full">{label}</span>
    </button>
  );
}
