import { test, expect } from '@playwright/test';
import { oeffneAppMitDemo } from './hilfen';

// CSV und DJI-SRT zusammen importieren: Der Dialog muss beide Formate
// erkennen, den SRT-Hinweis anzeigen und beide Flüge ins Logbuch übernehmen.
test('CSV und DJI-SRT werden erkannt und gemeinsam importiert', async ({ page }) => {
  await oeffneAppMitDemo(page);

  await page.getByRole('button', { name: 'Export, Import und Statistik' }).click();
  await page.getByRole('button', { name: 'Flüge importieren' }).click();

  const dialog = page.getByRole('dialog');
  const dateiFeld = dialog.locator('input[type="file"]');
  await dateiFeld.waitFor({ state: 'attached' });

  const csv = [
    'Date,Duration,Latitude,Longitude,Location',
    '2024-06-15 10:00,12,49.8700,8.6500,Testwiese E2E',
  ].join('\n');
  const srt = `1
00:00:00,000 --> 00:00:01,000
2024-06-16 10:15:30.000
[latitude: 48.100000] [longitude: 7.900000] [rel_alt: 0]

2
00:00:20,000 --> 00:00:21,000
2024-06-16 10:15:50.000
[latitude: 48.100000] [longitude: 7.900000] [rel_alt: 20]`;

  await dateiFeld.setInputFiles([
    { name: 'fluege.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) },
    { name: 'DJI_0001.SRT', mimeType: 'application/x-subrip', buffer: Buffer.from(srt) },
  ]);

  await expect(dialog.getByText('2024-06-15')).toBeVisible();
  await expect(dialog.getByText('2024-06-16')).toBeVisible();
  await expect(dialog.getByText('Dauer unter einer Minute – als 1 Minute gespeichert.')).toBeVisible();

  const importieren = dialog.getByRole('button', { name: '2 Flug/Flüge übernehmen' });
  await expect(importieren).toBeEnabled();
  await importieren.click();

  await expect(page.getByText('2 Flüge ins Logbuch übernommen.')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click();

  await page.getByRole('searchbox', { name: 'Flüge durchsuchen' }).fill('Testwiese E2E');
  await expect(page.getByText('Testwiese E2E').first()).toBeVisible();
});
