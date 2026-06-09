import { expect, test } from '@playwright/test';

const RESPONSIVE_ROUTES = [
  '/',
  '/dashboard',
  '/dashboard/generator',
  '/dashboard/statistics',
  '/privacy',
  '/privacy/direitos',
  '/terms',
  '/about',
] as const;

test('production standalone serves CSS and does not overflow core routes on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of RESPONSIVE_ROUTES) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    const metrics = await page.evaluate(() => ({
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      width: document.documentElement.clientWidth,
    }));

    expect(metrics.bodyBackground, `${route} should load compiled CSS`).not.toBe(
      'rgba(0, 0, 0, 0)'
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
          ),
        { message: `${route} should not horizontally overflow` }
      )
      .toBeLessThanOrEqual(metrics.width + 1);
  }
});
