import { Knopf } from './ui';
import { useSyncExternalStore } from 'react';
import { abonniereDialog, aktuelleAnfrage, antworteDialog } from '../services/dialog';
import { useSprache } from '../lib/sprache';

/** Rendert den jeweils aktuellen App-Dialog (Ersatz für alert/confirm).
 *  Einmal im App-Baum gemountet; der Dienst schiebt die Anfragen herein. */
export function DialogHost() {
  const { t } = useSprache();
  const anfrage = useSyncExternalStore(abonniereDialog, aktuelleAnfrage, aktuelleAnfrage);

  if (!anfrage) return null;

  const istBestaetigen = anfrage.art === 'bestaetigen';
  const bestaetigenLabel = anfrage.gefaehrlich ? t('aktion.loeschen') : t('dialog.ok');

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[90] flex items-center justify-center p-6"
      onClick={() => antworteDialog(false)}
    >
      <div
        className="bg-white w-full max-w-xs rounded-3xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        {anfrage.titel && (
          <h3 className="text-base font-black text-slate-900 mb-1.5">{anfrage.titel}</h3>
        )}
        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{anfrage.text}</p>

        <div className="flex gap-2 mt-5">
          {istBestaetigen && (
            <Knopf variante="sekundaer" className="flex-1" onClick={() => antworteDialog(false)}>
              {t('aktion.abbrechen')}
            </Knopf>
          )}
          <Knopf variante={anfrage.gefaehrlich ? 'gefahr' : 'primaer'} className="flex-1" onClick={() => antworteDialog(true)}>
            {istBestaetigen ? bestaetigenLabel : t('dialog.ok')}
          </Knopf>
        </div>
      </div>
    </div>
  );
}
