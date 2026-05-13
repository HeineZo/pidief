import { expect, test } from '@playwright/test';
import {
  continueToEdit,
  pageCards,
  uploadFixture,
  waitForFirstPageRendered,
} from './helpers';

test('mutation : supprimer une page diminue le nombre de cartes', async ({ page }) => {
  await page.goto('/');

  await uploadFixture(page, 'sample.pdf');
  await continueToEdit(page);

  const cards = pageCards(page);
  await expect(cards).toHaveCount(2);
  await waitForFirstPageRendered(page);

  const firstCard = cards.first();
  await firstCard.hover();
  await firstCard.locator('[data-action="delete"]').click({ force: true });

  await expect(cards).toHaveCount(1);
});
