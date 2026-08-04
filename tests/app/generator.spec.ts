import { test, expect } from '@playwright/test';

test('generator page renders configuration controls', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await expect(page.getByRole('heading', { name: 'Gerador de Apostas Otimizado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Configurações de Geração' })).toBeVisible();

  const headingLevels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((headings) =>
    headings.map((heading) => Number(heading.tagName.slice(1)))
  );
  expect(headingLevels[0]).toBe(1);
  expect(headingLevels.every((level, index) => index === 0 || level <= headingLevels[index - 1]! + 1)).toBe(true);
});
