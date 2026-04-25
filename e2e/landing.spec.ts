import { expect, test } from '@playwright/test';

test('landing page loads', async ({ page }) => {
  await page.goto('/gitInsights/');
  await expect(page).toHaveTitle(/gitInsights/);
});
