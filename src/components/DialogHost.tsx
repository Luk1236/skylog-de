import { Knopf } from './ui';
import { useId, useRef, useSyncExternalStore } from 'react';
import { abonniereDialog, aktuelleAnfrage, antworteDialog, type DialogAnfrage } from '../services/dialog';
import { useSprache } from '../lib/sprache';
import { useEbene } from '../lib/useEbene';
import { fokusFalle, useDialogFokus } from '../lib/useDialogFokus';

/** Rendert den jeweils aktuellen App-Dialog (Ersatz für alert/confirm).
 *  Einmal im App-Baum gemountet; der Dienst schiebt die Anfragen herein. */
export function DialogHost() {
  const anfrage = useSyncExternalStore(abonniereDialog, aktuelleAnfrage, aktuelleAnfrage);
  // Zurück/Escape = Abbrechen
  useEbene(!!anfrage, () => antworteDialog(false));

  if (!anfrage) return null;
  // Eigener Schlüssel je Anfrage: Jede Rückfrage holt den Fokus neu und gibt
  // ihn beim Schließen an ihren Auslöser zurück.
  return <Rueckfrage key={anfrage.id} anfrage={anfrage} />;
}

function Rueckfrage({ anfrage }: { anfrage: DialogAnfrage }) {
  const { t } = useSprache();
  const ebene = useRef<HTMLDivElement>(null);
  const titelId = useId();
  const textId = useId();
  // Fokus auf den sicheren Knopf: bei Rückfragen „Abbrechen“, sonst „OK“.
  useDialogFokus(ebene, '[data-start]');

  const istBestaetigen = anfrage.art === 'bestaetigen';
  const bestaetigenLabel = anfrage.gefaehrlich ? t('aktion.loeschen') : t('dialog.ok');

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex items-center justify-center p-6"
      onClick={() => antworteDialog(false)}
    >
      <div
        ref={ebene}
        className="bg-white w-full max-w-xs rounded-3xl shadow-2xl p-5 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={fokusFalle}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={anfrage.titel ? titelId : textId}
        aria-describedby={anfrage.titel ? textId : undefined}
        tabIndex={-1}
      >
        {anfrage.titel && (
          <h3 id={titelId} className="text-base font-black text-slate-900 mb-1.5">{anfrage.titel}</h3>
        )}
        <p id={textId} className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{anfrage.text}</p>

        <div className="flex gap-2 mt-5">
          {istBestaetigen && (
            <Knopf variante="sekundaer" className="flex-1" onClick={() => antworteDialog(false)} data-start>
              {t('aktion.abbrechen')}
            </Knopf>
          )}
          <Knopf
            variante={anfrage.gefaehrlich ? 'gefahr' : 'primaer'}
            className="flex-1"
            onClick={() => antworteDialog(true)}
            data-start={istBestaetigen ? undefined : true}
          >
            {istBestaetigen ? bestaetigenLabel : t('dialog.ok')}
          </Knopf>
        </div>
      </div>
    </div>
  );
}
