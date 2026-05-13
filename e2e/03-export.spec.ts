import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  continueToEdit,
  pageCards,
  uploadFixture,
  waitForFirstPageRendered,
} from './helpers';

test('export : téléchargement de pidief.pdf avec en-tête %PDF', async ({ page }) => {
  await page.goto('/');

  await uploadFixture(page, 'sample.pdf');
  await continueToEdit(page);
  await expect(pageCards(page)).toHaveCount(2);
  await waitForFirstPageRendered(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('pi-edit-screen [data-action="continue"]').click(),
  ]);

  expect(download.suggestedFilename()).toBe('pidief.pdf');

  const path = await download.path();
  const bytes = await readFile(path);
  expect(bytes.byteLength).toBeGreaterThan(100);
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
});
