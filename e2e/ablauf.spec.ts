import { test, expect } from '@playwright/test';
import { oeffneAppMitDemo, navigiere, oeffneMehr } from './hilfen';

// Abläufe, die beim Software-Check auf dem Handy kaputt waren - als Regressionstests.

test('Handy: Logbuch-Aktionen liegen im Bild, die Seite verschiebt sich nicht seitlich', async ({ page }) => {
  await oeffneAppMitDemo(page);
  const breite = page.viewportSize()!.width;
  for (const name of ['Neuer Flug', 'Assistent', 'Export, Import und Statistik']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x + box!.width, name).toBeLessThanOrEqual(breite);
  }
  const verschiebbar = await page.evaluate(() => {
    const scroller = document.querySelector('main > div');
    return scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : false;
  });
  expect(verschiebbar).toBe(false);
});

test('Flug loggen: Formular öffnet direkt, Flug speichern, suchen, löschen und zurückholen', async ({ page }) => {
  await oeffneAppMitDemo(page);
  await navigiere(page, 'Karte');
  await page.getByRole('button', { name: 'Flug loggen' }).click();
  await expect(page.getByRole('heading', { name: 'Flug eintragen' })).toBeVisible();

  // Drohne und Datum sind vorbelegt - nur Dauer und Ort eintragen
  await page.getByLabel('Dauer (Minuten)').fill('12');
  await page.getByLabel('Einsatzort').fill('Testwiese Nord');
  await page.getByRole('button', { name: 'Flug speichern' }).click();
  await expect(page.getByText('Testwiese Nord')).toBeVisible();

  await page.getByLabel('Flüge durchsuchen').fill('Testwiese');
  await expect(page.getByRole('button', { name: 'Flug löschen' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Flug löschen' }).click();
  await expect(page.getByText('Flug gelöscht')).toBeVisible();
  await expect(page.getByText('Testwiese Nord')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByText('Testwiese Nord')).toBeVisible();
});

test('Hinweise sind zusammengefasst und lassen sich für 7 Tage ausblenden', async ({ page }) => {
  await oeffneAppMitDemo(page);
  await page.getByRole('button', { name: /Hinweise/ }).click();
  const spaeter = page.getByRole('button', { name: 'In 7 Tagen' });
  const vorher = await spaeter.count();
  expect(vorher).toBeGreaterThan(1);
  await spaeter.first().click();
  await expect(spaeter).toHaveCount(vorher - 1);
});

test('Einstellungen zeigen die echte Version statt 1.0.0', async ({ page }) => {
  await oeffneAppMitDemo(page);
  await oeffneMehr(page, 'Einstellungen');
  await expect(page.getByText('Über die App')).toBeVisible();
  await expect(page.getByText(/^\d+\.\d+\.\d+/)).toBeVisible();
  await expect(page.getByText('1.0.0', { exact: true })).toHaveCount(0);
});
