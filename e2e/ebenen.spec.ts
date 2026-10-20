import { test, expect } from '@playwright/test';
import { oeffneAppMitDemo, navigiere } from './hilfen';

// Escape (Laptop) und die Android-Zurück-Taste schließen nur die oberste Ebene
// (services/ebenen.ts). Vorher schloss Escape alles auf einmal, und Zurück
// beendete auf Android die App samt laufendem Flug.

const CHECKLISTE = [
  'Flugakku voll geladen & fest arretiert', 'Fernsteuerung & Smartphone geladen',
  'Propeller fest & ohne Risse/Schäden', 'SD-Karte eingelegt & Speicher frei', 'Gimbal-Schutz entfernt',
  'Wind & Sichtweiten innerhalb der Limits', 'GPS-Empfang stabil (KP-Index niedrig)',
  'Keine Hindernisse (Bäume, Leitungen) im Startbereich', 'Keine unbeteiligten Personen im Gefahrenbereich',
  'Homepoint (RTH) aktualisiert', 'Flughöhen-Limit eingestellt (max 120m)',
  'e-ID sichtbar an der Drohne angebracht', 'DIPUL/Geo-Zonen Regelung geprüft',
];

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
  for (const punkt of CHECKLISTE) await page.getByRole('button', { name: punkt }).click();
  await page.getByRole('button', { name: /Ready to Fly/ }).click();
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
