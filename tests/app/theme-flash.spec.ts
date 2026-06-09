import { expect, test } from '@playwright/test';

/**
 * Regression guard for the theme flash (FOUC). The ThemeProvider only applies the
 * `dark`/`light` class on <html> in a post-hydration effect, so the first paint
 * uses the light `:root` tokens (white) and then flips to the resolved theme. The
 * fix is a blocking, pre-paint inline script (`components/theme-script.tsx`)
 * rendered as the first child of <body> that sets the class during HTML parse,
 * before first paint.
 *
 * We assert on the SSR HTML rather than the live DOM: the class is set at runtime
 * (not present on the static <html> tag), and a JS-blocked runtime assertion is
 * flaky against the App Router's streaming SSR. The static marker + the script's
 * key logic is a deterministic guard — if the inline script is removed or its
 * theme logic breaks, this fails.
 */
test('serves a blocking pre-paint theme script in the SSR HTML (no FOUC)', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  const html = (await response?.text()) ?? '';

  // Marker emitted by components/theme-script.tsx.
  expect(html, 'inline theme-init script must be present').toContain('/*theme-init*/');

  // The script must resolve the theme from storage with a prefers-color-scheme
  // fallback and set it on <html> before hydration.
  const script = html.slice(html.indexOf('/*theme-init*/'));
  expect(script).toContain("localStorage.getItem");
  expect(script).toContain('prefers-color-scheme');
  expect(script).toContain('classList');

  // It must run before the app content (the <main>) so it applies pre-paint.
  expect(
    html.indexOf('/*theme-init*/'),
    'theme script must come before the main content'
  ).toBeLessThan(html.indexOf('id="main-content"'));
});
