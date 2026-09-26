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
  '/resultados',
  '/resultados/2026',
  '/concurso/3005',
  '/concurso/2810',
  '/mega-da-virada',
  '/numeros',
  '/numeros/18',
] as const;

// URLs that match no route render app/global-not-found.tsx, which has its own
// <html> outside the root layout and so must load the design system itself.
test('an unknown URL answers a styled 404 that is not indexed', async ({ page }) => {
  const response = await page.goto('/pagina-que-nao-existe');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página não encontrada');
  await expect(page.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  // Next adds its own `noindex` to every 404 next to the page's metadata.
  const robots = await page
    .locator('meta[name="robots"]')
    .evaluateAll((metas) => metas.map((meta) => meta.getAttribute('content') ?? ''));
  expect(robots.length).toBeGreaterThan(0);
  for (const content of robots) {
    expect(content).toMatch(/noindex/);
  }

  const styles = await page.evaluate(() => ({
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    fontFamily: getComputedStyle(document.body).fontFamily,
  }));
  expect(styles.bodyBackground, 'the 404 page should load compiled CSS').not.toBe('rgba(0, 0, 0, 0)');
  expect(styles.fontFamily, 'the 404 page should use the site font').not.toMatch(/Times/);
});

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
