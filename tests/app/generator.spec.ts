import { test, expect } from '@playwright/test';

test('generator page renders configuration controls', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await expect(page.getByRole('heading', { name: 'Gerador de Apostas Otimizado' })).toBeVisible();
  await expect(page.getByText('Configurações de Geração')).toBeVisible();
});
