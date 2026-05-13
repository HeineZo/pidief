import { expect, test } from '@playwright/test';
import { dropZoneInput, uploadFixture } from './helpers';

test('fichier non-PDF : aucun ajout, la région fichiers reste cachée', async ({ page }) => {
  await page.goto('/');

  await dropZoneInput(page).setInputFiles({
    name: 'note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Ceci n\u2019est pas un PDF'),
  });

  await expect(page.locator('[data-files-region]')).toBeHidden();
  await expect(page.locator('pi-file-chip')).toHaveCount(0);
});

test('PDF chiffré : toast d\u2019erreur, on reste sur l\u2019écran d\u2019upload', async ({ page }) => {
  await page.goto('/');

  await uploadFixture(page, 'encrypted.pdf');

  await page.locator('pi-upload-screen [data-action="continue"]').click();

  await expect(
    page.getByText(/(impossible d.?ouvrir le pdf|couldn.?t open the pdf)/i),
  ).toBeVisible({
    timeout: 10_000,
  });

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('pi-upload-screen')).toBeVisible();
  await expect(page.locator('pi-edit-screen')).toHaveCount(0);

  await expect(page).not.toHaveURL(/\/edit$/);
});
