import { test, expect } from '@playwright/test';

test('dashboard renders core sections', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Últimos Sorteios' })).toBeVisible();
});
