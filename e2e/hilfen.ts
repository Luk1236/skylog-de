import { expect, type Page } from '@playwright/test';

/** App öffnen, Willkommensdialog überspringen, Animationen abschalten. */
export async function oeffneApp(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((t) => {
    try { localStorage.setItem('skylog_theme', t); } catch { /* egal */ }
  }, theme);
  await page.goto('/');
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  // Willkommensdialog erscheint erst nach dem Laden der Daten - darauf warten.
  const spaeter = page.getByRole('button', { name: 'Später' });
  await spaeter.waitFor({ timeout: 8000 }).then(() => spaeter.click()).catch(() => { /* schon eingerichtet */ });
  await spaeter.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  await setzeTheme(page, theme);
}

export async function setzeTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
}

/** Einen Reiter der unteren Navigation öffnen. */
export async function navigiere(page: Page, reiter: 'Karte' | 'Logbuch' | 'Flotte' | 'Safety' | 'Mehr') {
  await page.locator('nav').getByRole('button', { name: reiter }).first().click();
}

/** Einen Eintrag aus dem „Mehr"-Menü öffnen. */
export async function oeffneMehr(page: Page, eintrag: string) {
  await navigiere(page, 'Mehr');
  await page.getByRole('button', { name: eintrag, exact: true }).click();
}

export interface KontrastFund { text: string; kontrast: number; groesse: string; klasse: string }

/** Misst den Kontrast aller sichtbaren Texte gegen ihren tatsächlichen
 *  Hintergrund (halbtransparente Flächen werden verrechnet). Texte auf Bildern
 *  oder Verläufen und in der Karte werden übersprungen. */
export async function messeKontrast(page: Page, grenze: number): Promise<KontrastFund[]> {
  return page.evaluate((g) => {
    const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgb = (c: string) => {
      cv.clearRect(0, 0, 1, 1); cv.fillStyle = 'rgba(0,0,0,0)'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1);
      const d = cv.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
    const lum = ({ r, g: gg, b }: { r: number; g: number; b: number }) => {
      const f = (x: number) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
    };
    type C = { r: number; g: number; b: number; a: number };
    const ueber = (o: C, u: C): C => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a: 1 });
    const dunkel = document.documentElement.dataset.theme === 'dark';
    const hintergrund = (el: Element): C | null => {
      const schichten: C[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== 'none') return null;
        const c = rgb(cs.backgroundColor);
        if (c.a > 0) { schichten.push(c); if (c.a >= 0.99) break; }
      }
      const basis: C = dunkel ? { r: 15, g: 23, b: 42, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
      return schichten.reverse().reduce((acc, s) => ueber(s, acc), basis);
    };
    const sichtbar = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      }
      return true;
    };
    const funde: { text: string; kontrast: number; groesse: string; klasse: string }[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent!.trim())) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest('.leaflet-container') || !sichtbar(el)) continue;
      const cs = getComputedStyle(el);
      if (parseFloat(cs.opacity) < 0.5) continue; // bewusst ausgegraute (deaktivierte) Elemente
      if ((el as HTMLElement).closest('button:disabled')) continue;
      const bg = hintergrund(el); if (!bg) continue;
      const a = lum(rgb(cs.color)), b = lum(bg);
      const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (k < g) funde.push({ text: el.textContent!.trim().slice(0, 50), kontrast: +k.toFixed(2), groesse: cs.fontSize, klasse: String((el as HTMLElement).className).slice(0, 80) });
    }
    return funde;
  }, grenze);
}

/** Erwartet keine Texte unter der Kontrastgrenze - mit lesbarer Fehlermeldung. */
export async function erwarteKontrast(page: Page, wo: string, grenze: number) {
  const funde = await messeKontrast(page, grenze);
  expect(funde, `${wo}: Texte unter ${grenze}:1\n${funde.map(f => `  ${f.kontrast} ${f.groesse} "${f.text}" (${f.klasse})`).join('\n')}`).toEqual([]);
}
