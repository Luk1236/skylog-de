import { useEffect, type KeyboardEvent, type RefObject } from 'react';

const FOKUSSIERBAR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(', ');

const fokussierbare = (box: HTMLElement): HTMLElement[] =>
  [...box.querySelectorAll<HTMLElement>(FOKUSSIERBAR)].filter(el => !el.closest('[hidden], [inert]'));

/** Fokusführung für modale Ebenen (WAI-ARIA-Muster „Dialog“): Beim Öffnen
 *  wandert der Fokus in die Ebene, beim Schließen zurück auf den Auslöser.
 *  Ohne das blieb der Fokus hinter dem Dialog stehen - Tastatur und
 *  Screenreader (TalkBack) arbeiteten dann auf der verdeckten Seite weiter.
 *
 *  `start`: Selektor für das Element, das den Fokus bekommen soll (z.B. der
 *  sichere Knopf einer Rückfrage); sonst die Ebene selbst (tabIndex -1), damit
 *  auf dem Handy keine Tastatur aufklappt. Ein Feld mit autoFocus behält ihn. */
export function useDialogFokus(ref: RefObject<HTMLElement | null>, start?: string): void {
  useEffect(() => {
    const ausloeser = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const ebene = ref.current;
    if (ebene && !ebene.contains(document.activeElement)) {
      const ziel = start ? ebene.querySelector<HTMLElement>(start) : null;
      (ziel ?? ebene).focus({ preventScroll: true });
    }
    return () => {
      if (ausloeser?.isConnected) {
        ausloeser.focus({ preventScroll: true });
        return;
      }
      // Auslöser gibt es nicht mehr (z.B. gelöschter Eintrag): dann wenigstens
      // in die Ebene darunter, statt den Fokus auf der Seite zu verlieren.
      const darunter = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].pop();
      darunter?.focus({ preventScroll: true });
    };
  }, [ref, start]);
}

/** onKeyDown der Ebene: Tab und Umschalt+Tab laufen am Rand im Kreis, statt
 *  auf die Seite dahinter zu springen. */
export function fokusFalle(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'Tab' || e.defaultPrevented) return;
  const ebene = e.currentTarget;
  const elemente = fokussierbare(ebene);
  if (!elemente.length) {
    e.preventDefault();
    return;
  }
  const erstes = elemente[0];
  const letztes = elemente[elemente.length - 1];
  const aktiv = document.activeElement;
  if (e.shiftKey && (aktiv === erstes || aktiv === ebene)) {
    e.preventDefault();
    letztes.focus();
  } else if (!e.shiftKey && aktiv === letztes) {
    e.preventDefault();
    erstes.focus();
  }
}
