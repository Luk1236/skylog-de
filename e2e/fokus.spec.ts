import { test, expect } from '@playwright/test';
import { oeffneAppMitDemo, navigiere } from './hilfen';

// Dialoge führen den Tastatur-Fokus (WAI-ARIA): hinein beim Öffnen, Tab bleibt
// drin, zurück auf den Auslöser beim Schließen. Vorher blieb der Fokus hinter
// dem Dialog, und Tab landete auf verdeckten Knöpfen (Software-Check R3-03).

test('Wartungsdialog per Tastatur: Fokus hinein, drin und zurück', async ({ page }) => {
  await oeffneAppMitDemo(page);
  await navigiere(page, 'Flotte');
  const ausloeser = page.getByRole('button', { name: 'Wartung', exact: true }).first();
  await ausloeser.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /Wartungshistorie/ });
  await expect(dialog).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(ausloeser).toBeFocused();
});

test('Rückfrage: Name, Fokus auf Abbrechen, zurück zum Auslöser', async ({ page }) => {
  await oeffneAppMitDemo(page);
  await page.getByRole('button', { name: 'Assistent' }).click();
  await page.getByRole('button', { name: 'Weiter zur Checkliste' }).click();
  await page.getByRole('button', { name: 'Checkliste bearbeiten' }).first().click();
  const zuruecksetzen = page.getByRole('button', { name: 'Auf Standard zurücksetzen' });
  await zuruecksetzen.click();
  const frage = page.getByRole('alertdialog', { name: /Standardpunkte/ });
  await expect(frage).toBeVisible();
  await expect(frage.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(zuruecksetzen).toBeFocused();
});
