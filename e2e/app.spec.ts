import { test, expect, type Page, type Locator } from '@playwright/test';
import { oeffneApp, navigiere, oeffneMehr } from './hilfen';

/** Liegt das Element ganz oben (nicht von etwas anderem verdeckt)? */
async function liegtOben(page: Page, el: Locator): Promise<boolean> {
  const box = await el.boundingBox();
  if (!box) return false;
  return el.evaluate((node, p) => {
    const oben = document.elementFromPoint(p.x, p.y);
    return !!oben && (node === oben || node.contains(oben));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
}

async function tippePin(page: Page, pin: string) {
  for (const z of pin) await page.getByRole('button', { name: z, exact: true }).click();
}

test('App startet und alle Hauptansichten öffnen sich', async ({ page }) => {
  await oeffneApp(page);
  await expect(page).toHaveTitle(/SkyLog DE/);
  await navigiere(page, 'Logbuch');
  await expect(page.getByRole('heading', { name: 'Logbuch' })).toBeVisible();
  await navigiere(page, 'Flotte');
  await expect(page.getByRole('heading', { name: 'Flotte' })).toBeVisible();
  await navigiere(page, 'Sicherheit');
  await expect(page.getByRole('heading', { name: 'Sicherheit', exact: true })).toBeVisible();
  await oeffneMehr(page, 'Profil');
  await expect(page.getByRole('heading', { name: 'Pilotenprofil' })).toBeVisible();
  await oeffneMehr(page, 'Einstellungen');
  await expect(page.getByText('Datensicherung', { exact: true })).toBeVisible();
});

test('Kartenelemente verdecken keine Dialoge', async ({ page }) => {
  await oeffneApp(page);
  // Vorher: die Kartenelemente liegen sichtbar oben
  const kartenElemente = [
    page.getByRole('button', { name: 'Flug loggen' }),
    page.getByRole('button', { name: 'Flugplaner öffnen' }),
    page.getByRole('button', { name: 'Von Hand' }),
  ];
  for (const el of kartenElemente) expect(await liegtOben(page, el)).toBe(true);

  // Bei offenem Dialog darf keines davon mehr obenauf liegen
  await oeffneMehr(page, 'Datensicherung & Erinnerung');
  await expect(page.getByRole('button', { name: 'Sicherung jetzt exportieren' })).toBeVisible();
  for (const el of kartenElemente) expect(await liegtOben(page, el)).toBe(false);
});

test('Ersatzteil anlegen, Bestand ändern, bleibt nach Neuladen erhalten', async ({ page }) => {
  await oeffneApp(page);
  await oeffneMehr(page, 'Inventar');
  await page.getByRole('button', { name: 'Teil hinzufügen' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Propeller-Satz');
  await page.getByLabel('Link zu STL-Datei oder Shop').fill('https://example.org/propeller');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Propeller-Satz')).toBeVisible();
  await page.getByRole('button', { name: 'Eins mehr' }).click();
  await expect(page.getByText('2', { exact: true })).toBeVisible();

  await page.reload();
  await oeffneApp(page);
  await oeffneMehr(page, 'Inventar');
  await expect(page.getByText('Propeller-Satz')).toBeVisible();
  await expect(page.getByText('2', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Link' })).toHaveAttribute('href', 'https://example.org/propeller');
});

test('Bildschirmsperre: einrichten, falsche PIN abweisen, richtige entsperrt', async ({ page }) => {
  await oeffneApp(page);
  await oeffneMehr(page, 'Einstellungen');
  await page.getByRole('button', { name: 'PIN einrichten oder ändern' }).click();
  // Je nach Zustand erst "einrichten" waehlen
  const einrichten = page.getByRole('dialog').getByRole('button', { name: /einrichten/i });
  if (await einrichten.isVisible().catch(() => false)) await einrichten.click();
  await tippePin(page, '2580');
  await tippePin(page, '2580');
  await expect(page.getByText('PIN erfolgreich eingerichtet!')).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByText('SkyLog DE Entsperren')).toBeVisible();
  await tippePin(page, '1111');
  await expect(page.getByText('Falscher PIN. Bitte erneut versuchen.')).toBeVisible({ timeout: 10_000 });
  await tippePin(page, '2580');
  await expect(page.getByText('SkyLog DE Entsperren')).toBeHidden({ timeout: 10_000 });
});
