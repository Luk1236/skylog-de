import { test, expect } from '@playwright/test';
import { oeffneAppMitDemo, navigiere } from './hilfen';

// Die OSM-Lizenz verlangt eine sichtbare Namensnennung. Nach Runde 12 brach sie
// am Handy auf zwei Zeilen um, und die Karten unten verdeckten die erste Zeile.

for (const theme of ['light', 'dark'] as const) {
  test(`Namensnennung der Hauptkarte ist sichtbar und nicht verdeckt (${theme})`, async ({ page }) => {
    await oeffneAppMitDemo(page, theme);
    await navigiere(page, 'Karte');
    const link = page.locator('.leaflet-control-attribution a', { hasText: 'OpenStreetMap' });
    await expect(link).toBeVisible();
    const frei = await link.evaluate(a => {
      const r = a.getBoundingClientRect();
      const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!oben && (oben === a || a.contains(oben));
    });
    expect(frei).toBe(true);
    // eine Zeile: nicht höher als zwei Textzeilen
    const hoehe = await page.locator('.leaflet-control-attribution').evaluate(e => e.getBoundingClientRect().height);
    expect(hoehe).toBeLessThan(24);
  });
}
