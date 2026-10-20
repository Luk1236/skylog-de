import { test, expect } from '@playwright/test';
import { oeffneAppMitDemo, navigiere } from './hilfen';
import { DEFAULT_PREFLIGHT } from '../src/services/checklists';

// Escape (Laptop) und die Android-Zurück-Taste schließen nur die oberste Ebene
// (services/ebenen.ts). Vorher schloss Escape alles auf einmal, und Zurück
// beendete auf Android die App samt laufendem Flug.

test('Escape schließt nur den obersten Dialog', async ({ page }) => {
  await oeffneAppMitDemo(page);
  await navigiere(page, 'Flotte');
  await page.getByRole('button', { name: 'Wartung', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: /Wartungshistorie/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Die Ansicht darunter bleibt offen
  await expect(page.getByRole('heading', { name: 'Flotte', exact: true })).toBeVisible();
});

test('Flug-Assistent: laufender Flug wird nicht ohne Rückfrage verworfen', async ({ page }) => {
  await oeffneAppMitDemo(page);
  await page.getByRole('button', { name: 'Assistent' }).click();
  await page.getByRole('button', { name: 'Weiter zur Checkliste' }).click();
  // Die anpassbare Vorflug-Checkliste ist Pflicht: erst alles abhaken, dann starten
  const starten = page.getByRole('button', { name: /Startklar/ });
  await expect(starten).toBeDisabled();
  for (const punkt of DEFAULT_PREFLIGHT) await page.getByRole('checkbox', { name: punkt }).click();
  await starten.click();
  await page.getByRole('button', { name: 'Flugabschnitt starten' }).click();

  // Escape: erst kommt die Rückfrage, der Assistent bleibt offen
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toContainText('aufgezeichnete Flug');
  // Noch einmal Escape bricht nur die Rückfrage ab
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Flugabschnitt beenden' })).toBeVisible();

  // Schließen-Knopf + Bestätigen verwirft den Flug bewusst
  await page.getByRole('button', { name: 'Assistent schließen' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('button', { name: 'Flugabschnitt beenden' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Logbuch', exact: true })).toBeVisible();
});
