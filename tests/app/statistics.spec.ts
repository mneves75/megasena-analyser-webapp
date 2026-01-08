import { test, expect } from '@playwright/test';

test('statistics page renders key analysis sections', async ({ page }) => {
  await page.goto('/dashboard/statistics');
  await expect(page.getByRole('heading', { name: 'Estatísticas Detalhadas' })).toBeVisible();
  await expect(page.getByText('Números Quentes')).toBeVisible();
});
