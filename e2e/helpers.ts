import { expect, type Locator, type Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

export const fixturePath = (filename: string): string => join(FIXTURES_DIR, filename);

export function dropZoneInput(page: Page): Locator {
  return page.locator('pi-drop-zone input[type="file"]');
}

export function pageCards(page: Page): Locator {
  return page.locator('pi-page-card');
}

export async function uploadFixture(page: Page, filename: string): Promise<void> {
  await dropZoneInput(page).setInputFiles(fixturePath(filename));
  await expect(page.locator('[data-files-region]')).toBeVisible();
}

export async function continueToEdit(page: Page): Promise<void> {
  await page.locator('pi-upload-screen [data-action="continue"]').click();
  await expect(page).toHaveURL(/\/edit$/);
}

export async function waitForFirstPageRendered(page: Page): Promise<void> {
  const firstCard = pageCards(page).first();
  await firstCard.waitFor({ state: 'visible', timeout: 15_000 });
  await expect
    .poll(
      async () => firstCard.locator('canvas[data-canvas]').evaluate((el) => (el as HTMLCanvasElement).width),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
}
