import { expect, test } from '@playwright/test';
import {
  continueToEdit,
  pageCards,
  uploadFixture,
  waitForFirstPageRendered,
} from './helpers';

test('parcours nominal : upload PDF → /edit → grille rendue', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('pi-upload-screen')).toBeVisible();

  await uploadFixture(page, 'sample.pdf');

  const count = page.locator('[data-count]');
  await expect(count).toContainText('1 /');
  await expect(count).toContainText('PDF');

  await continueToEdit(page);

  await expect(page.locator('pi-edit-screen')).toBeVisible();
  await expect(pageCards(page)).toHaveCount(2);

  await waitForFirstPageRendered(page);
});
