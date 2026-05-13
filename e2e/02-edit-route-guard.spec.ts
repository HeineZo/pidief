import { expect, test } from '@playwright/test';

test('garde de route : /edit sans PDF ouvert redirige vers /', async ({ page }) => {
  await page.goto('/edit');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('pi-upload-screen')).toBeVisible();
  await expect(page.locator('pi-edit-screen')).toHaveCount(0);
});

test('route inconnue redirige vers /', async ({ page }) => {
  await page.goto('/n-existe-pas');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('pi-upload-screen')).toBeVisible();
});
