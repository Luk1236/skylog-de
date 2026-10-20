import { test, type Page } from '@playwright/test';
import { oeffneApp, navigiere, oeffneMehr, erwarteKontrast } from './hilfen';

// Kontrast-Wächter: misst in hellem und dunklem Modus jede Hauptansicht und
// die wichtigsten Dialoge. Grenze 3.8:1 statt WCAG-AA 4.5:1, weil der
// gedämpfte Text (slate-400) bewusst ein Kompromiss ist (Weiß ~4.1, dunkle
// Dialoge ~4.4, s. index.css). Alles darunter ist ein echter Lesbarkeitsfehler.
const GRENZE = 3.8;

const ANSICHTEN: { name: string; oeffnen: (p: Page) => Promise<void> }[] = [
  { name: 'Karte', oeffnen: p => navigiere(p, 'Karte') },
  { name: 'Logbuch', oeffnen: p => navigiere(p, 'Logbuch') },
  { name: 'Flotte', oeffnen: p => navigiere(p, 'Flotte') },
  { name: 'Safety', oeffnen: p => navigiere(p, 'Safety') },
  { name: 'Mehr-Menü', oeffnen: p => navigiere(p, 'Mehr') },
  { name: 'Inventar', oeffnen: p => oeffneMehr(p, 'Inventar') },
  { name: 'Piloten', oeffnen: p => oeffneMehr(p, 'Piloten') },
  { name: 'LBA Info', oeffnen: p => oeffneMehr(p, 'LBA Info') },
  { name: 'Roadmap', oeffnen: p => oeffneMehr(p, 'Roadmap') },
  { name: 'Profil', oeffnen: p => oeffneMehr(p, 'Profil') },
];

const DIALOGE: { name: string; oeffnen: (p: Page) => Promise<void> }[] = [
  { name: 'Vorflug-Check', oeffnen: p => oeffneMehr(p, 'Pre-Flight Safety Score & Kp-Index') },
  { name: 'Kunden (CRM)', oeffnen: p => oeffneMehr(p, 'CRM & Kundenverwaltung') },
  { name: 'SORA-Assistent', oeffnen: p => oeffneMehr(p, 'EASA SORA 2.5 PDF Assistent') },
  { name: 'Datensicherung', oeffnen: p => oeffneMehr(p, 'Datensicherung & Erinnerung') },
  { name: 'Staffelmatrix', oeffnen: p => oeffneMehr(p, 'Staffel- & Flottenmatrix') },
  { name: 'Flugplaner', oeffnen: async p => { await navigiere(p, 'Karte'); await p.getByRole('button', { name: 'Flugplaner öffnen' }).click(); } },
  { name: 'Offline-Karten', oeffnen: async p => { await navigiere(p, 'Karte'); await p.getByRole('button', { name: 'Offline-Karten verwalten' }).click(); } },
  { name: 'EU-Zonen', oeffnen: async p => { await navigiere(p, 'Karte'); await p.getByRole('button', { name: 'Zonen anderer Länder' }).click(); } },
  { name: 'Behörden-Check', oeffnen: p => p.getByRole('button', { name: 'Behörden-Check anzeigen' }).click() },
  { name: 'Risiko-Check', oeffnen: async p => { await navigiere(p, 'Safety'); await p.getByText('Risiko-Check (Betriebskategorie)').click(); } },
  { name: 'Vorfall-Bericht', oeffnen: async p => { await navigiere(p, 'Safety'); await p.getByText('Vorfall-Bericht erstellen').click(); } },
  { name: 'e-ID', oeffnen: async p => { await navigiere(p, 'Safety'); await p.getByRole('button', { name: 'e-ID Verwalten' }).click(); } },
  { name: 'Bildschirmsperre', oeffnen: async p => { await oeffneMehr(p, 'Profil'); await p.getByRole('button', { name: 'Bildschirmsperre (PIN) verwalten' }).click(); } },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`Kontrast ${theme === 'light' ? 'hell' : 'dunkel'}`, () => {
    for (const a of [...ANSICHTEN, ...DIALOGE]) {
      test(a.name, async ({ page }) => {
        await oeffneApp(page, theme);
        await a.oeffnen(page);
        await page.waitForTimeout(600); // lazy geladene Teile
        await erwarteKontrast(page, `${a.name} (${theme})`, GRENZE);
      });
    }
  });
}
