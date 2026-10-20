import { test } from '@playwright/test';
const out = process.env.SHOT_DIR!;
test('englisch', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('skylog_sprache', 'en'); });
  await page.goto('/');
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
  await page.screenshot({ path: `${out}/en-welcome.png` });
  await page.getByRole('button', { name: 'Later' }).click();
  await page.locator('nav').getByRole('button', { name: 'Logbook' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/en-logbook.png`, fullPage: true });
  await page.locator('nav').getByRole('button', { name: 'Safety' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/en-safety.png` });
});
