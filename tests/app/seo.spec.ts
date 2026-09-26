import { writeFile } from 'node:fs/promises';
import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * SEO / programmatic-SEO contract, exercised against the production build.
 *
 * Facts come from the E2E seed in scripts/prepare-e2e-db.ts: contests 3001–3006,
 * drawn 2026-05-02..2026-05-12, odd contests with one sena winner, even contests
 * accumulated. Number 18 is the only number drawn twice (3002 and 3006) and
 * number 5 is never drawn.
 */

const SITE = (process.env['NEXT_PUBLIC_BASE_URL'] ?? 'https://megasena-analyzer.com.br').replace(
  /\/$/,
  ''
);
const GOOGLEBOT_UA =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const GPTBOT_UA =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)';

const SEEDED_CONTESTS = [3001, 3002, 3003, 3004, 3005, 3006] as const;

interface PageAudit {
  path: string;
  status: number;
  title: string;
  titleInHead: boolean;
  description: string | null;
  canonical: string | null;
  canonicalInHead: boolean;
  ogUrl: string | null;
  ogImage: string | null;
  robots: string | null;
  h1Count: number;
  h1: string;
  jsonLdTypes: string[];
  jsonLdErrors: string[];
  jsonLdMissingNonce: number;
}

// Each simulated crawler gets its own documentation-range client IP, like a real
// crawler, so the API's per-visitor quota (100 req/min) is not shared with the
// rest of the suite, which all runs from loopback.
const CRAWLER_IPS = {
  audit: '203.0.113.10',
  gptbot: '203.0.113.11',
  googlebotStatus: '203.0.113.12',
  browserStatus: '203.0.113.13',
} as const;

/** A no-JS page sees exactly the server HTML, which is what non-rendering crawlers read. */
async function openCrawlerPage(
  browser: Browser,
  clientIp: string,
  userAgent = GOOGLEBOT_UA
): Promise<Page> {
  const context = await browser.newContext({
    userAgent,
    javaScriptEnabled: false,
    extraHTTPHeaders: { 'X-Forwarded-For': clientIp },
  });
  return context.newPage();
}

async function auditPage(page: Page, path: string): Promise<PageAudit> {
  const response = await page.goto(path);
  const status = response?.status() ?? 0;
  // Read the nonce from the raw HTML: Chrome hides nonce attributes in the DOM.
  const html = (await response?.text()) ?? '';
  const jsonLdMissingNonce = Array.from(
    html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>/g)
  ).filter((match) => !/\snonce="[^"]+"/.test(match[0])).length;
  const snapshot = await page.evaluate(() => {
    const meta = (selector: string) =>
      document.querySelector(selector)?.getAttribute('content') ?? null;
    const jsonLdTypes: string[] = [];
    const jsonLdErrors: string[] = [];
    const collectTypes = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(collectTypes);
        return;
      }
      if (node && typeof node === 'object') {
        const record = node as Record<string, unknown>;
        const type = record['@type'];
        if (typeof type === 'string') {
          jsonLdTypes.push(type);
        }
        const graph = record['@graph'];
        if (Array.isArray(graph)) {
          graph.forEach(collectTypes);
        }
      }
    };
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        collectTypes(JSON.parse(script.textContent ?? ''));
      } catch (error) {
        jsonLdErrors.push(String(error));
      }
    });
    const h1s = Array.from(document.querySelectorAll('h1'));
    return {
      title: document.title,
      titleInHead: document.head.querySelector('title') !== null,
      description: meta('meta[name="description"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      canonicalInHead: document.head.querySelector('link[rel="canonical"]') !== null,
      ogUrl: meta('meta[property="og:url"]'),
      ogImage: meta('meta[property="og:image"]'),
      robots: meta('meta[name="robots"]'),
      h1Count: h1s.length,
      h1: h1s[0]?.textContent?.trim() ?? '',
      jsonLdTypes,
      jsonLdErrors,
    };
  });
  return { path, status, jsonLdMissingNonce, ...snapshot };
}

async function sitemapPaths(page: Page): Promise<Array<{ loc: string; lastmod: string | null }>> {
  const response = await page.request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  return Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/g)).map((match) => {
    const block = match[1] ?? '';
    return {
      loc: block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '',
      lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null,
    };
  });
}

function definitionFor(page: Page, term: string) {
  return page
    .getByRole('term')
    .filter({ hasText: term })
    .locator('xpath=following-sibling::dd[1]');
}

test.describe('crawl directives', () => {
  test('robots.txt lets crawlers fetch render assets and points at the sitemap', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).not.toMatch(/Disallow:\s*\/_next\//);
    expect(body).toMatch(/Disallow:\s*\/api\//);
    expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  test('sitemap lists every indexable route with data-derived lastmod', async ({ page }) => {
    const entries = await sitemapPaths(page);
    const locs = entries.map((entry) => entry.loc);

    expect(new Set(locs).size).toBe(locs.length);
    for (const loc of locs) {
      expect(loc.startsWith(`${SITE}/`) || loc === SITE).toBe(true);
      expect(loc).not.toContain('/api/');
    }

    const expected = [
      SITE,
      `${SITE}/dashboard`,
      `${SITE}/dashboard/statistics`,
      `${SITE}/dashboard/generator`,
      `${SITE}/resultados`,
      `${SITE}/resultados/2026`,
      `${SITE}/numeros`,
      `${SITE}/about`,
      `${SITE}/terms`,
      `${SITE}/privacy`,
      `${SITE}/privacy/direitos`,
      ...SEEDED_CONTESTS.map((contest) => `${SITE}/concurso/${contest}`),
      ...Array.from({ length: 60 }, (_, index) => `${SITE}/numeros/${index + 1}`),
    ];
    for (const loc of expected) {
      expect(locs, `sitemap should list ${loc}`).toContain(loc);
    }

    // lastmod = when the page's content or links last changed in the archive.
    // The seed (prepare-e2e-db.ts) loads each draw three days after it happened
    // and corrects contest 3002 at 2026-05-21T01:30Z (22:30 on 05-20 in Brasília).
    const lastmodFor = (loc: string) => entries.find((entry) => entry.loc === loc)?.lastmod;
    // 3001 predates the correction: it changed when 3002 was first loaded and
    // added the "Próximo concurso" link (3002 drawn 05-04, loaded 05-07).
    expect(lastmodFor(`${SITE}/concurso/3001`)).toBe('2026-05-07T12:00:00.000Z');
    // Every later draw page embeds history that includes 3002, so the
    // correction moves them all.
    for (const contest of [3002, 3003, 3004, 3005, 3006]) {
      expect(lastmodFor(`${SITE}/concurso/${contest}`)).toBe('2026-05-21T01:30:00.000Z');
    }
    expect(lastmodFor(`${SITE}/resultados/2026`)).toBe('2026-05-21T01:30:00.000Z');
    expect(lastmodFor(`${SITE}/resultados`)).toBe('2026-05-21T01:30:00.000Z');
    expect(lastmodFor(`${SITE}/numeros/18`)).toBe('2026-05-21T01:30:00.000Z');
    expect(lastmodFor(`${SITE}/about`)).toBeNull();
  });

  test('llms.txt summarizes the site for AI agents', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^text\/(plain|markdown)/);
    const body = await response.text();
    expect(body.startsWith('# Mega-Sena Analyzer')).toBe(true);
    expect(body).toContain(`${SITE}/resultados`);
    expect(body).toContain(`${SITE}/numeros`);
    expect(body).toContain(`${SITE}/concurso/3006`);
    expect(body).toMatch(/não (prevê|há previsão)/i);
  });
});

test.describe('HTTP semantics for programmatic routes', () => {
  for (const userAgent of [GOOGLEBOT_UA, undefined]) {
    const label = userAgent ? 'Googlebot' : 'browser';

    const clientIp = userAgent ? CRAWLER_IPS.googlebotStatus : CRAWLER_IPS.browserStatus;

    test(`missing or malformed pages answer 404 to ${label}`, async ({ playwright, baseURL }) => {
      const api = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { 'X-Forwarded-For': clientIp },
        ...(userAgent ? { userAgent } : {}),
      });
      for (const path of [
        '/concurso/3007',
        '/concurso/0',
        '/concurso/abc',
        '/concurso/-1',
        '/numeros/0',
        '/numeros/61',
        '/numeros/abc',
        '/resultados/2025',
        '/resultados/1995',
        '/resultados/abcd',
      ]) {
        const response = await api.get(path, { maxRedirects: 0 });
        expect(response.status(), `${path} should be a hard 404`).toBe(404);
      }
      await api.dispose();
    });

    test(`zero-padded aliases redirect permanently for ${label}`, async ({
      playwright,
      baseURL,
    }) => {
      const api = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { 'X-Forwarded-For': clientIp },
        ...(userAgent ? { userAgent } : {}),
      });
      for (const [alias, canonical] of [
        ['/concurso/03006', '/concurso/3006'],
        ['/numeros/05', '/numeros/5'],
      ] as const) {
        const response = await api.get(alias, { maxRedirects: 0 });
        expect([301, 308], `${alias} should redirect permanently`).toContain(response.status());
        expect(new URL(response.headers()['location'] ?? '', 'http://x').pathname).toBe(canonical);
      }
      await api.dispose();
    });
  }
});

test.describe('archive API boundary', () => {
  test('rejects malformed, ambiguous or out-of-range queries', async ({ request }) => {
    for (const path of [
      '/api/draws?contest=abc',
      '/api/draws?contest=0',
      '/api/draws?contest=03006',
      '/api/draws?contest=-5',
      '/api/draws?contest=1e3',
      '/api/draws?contest=99999999',
      '/api/draws?year=1995',
      '/api/draws?year=2101',
      '/api/draws?year=02026',
      '/api/draws?year=2026&contest=3005',
      '/api/numbers?n=0',
      '/api/numbers?n=61',
      '/api/numbers?n=05',
      '/api/numbers?n=%2018',
    ]) {
      const response = await request.get(path);
      expect(response.status(), `${path} should be rejected`).toBe(400);
      expect(await response.json()).toMatchObject({ success: false });
    }
  });

  test('distinguishes missing data (404) from bad input and rejects writes', async ({
    request,
  }) => {
    expect((await request.get('/api/draws?contest=3007')).status()).toBe(404);
    expect((await request.get('/api/draws?year=2025')).status()).toBe(404);
    expect((await request.post('/api/draws', { data: {} })).status()).toBe(405);
    expect((await request.post('/api/numbers', { data: {} })).status()).toBe(405);
    expect((await request.post('/api/sitemap', { data: {} })).status()).toBe(405);

    const draw = await request.get('/api/draws?contest=3005');
    expect(draw.status()).toBe(200);
    expect(draw.headers()['cache-control']).toContain('no-store');
    expect(await draw.json()).toMatchObject({
      draw: { contestNumber: 3005, numbers: [7, 15, 24, 33, 42, 60] },
      previous: { contestNumber: 3004 },
      next: { contestNumber: 3006 },
    });
  });
});

test('every sitemap page ships complete, unique, crawler-visible metadata', async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const page = await openCrawlerPage(browser, CRAWLER_IPS.audit);
  const entries = await sitemapPaths(page);
  const audits: PageAudit[] = [];

  for (const { loc } of entries) {
    const path = new URL(loc).pathname;
    audits.push(await auditPage(page, path));
  }

  const auditPath = testInfo.outputPath('seo-audit.json');
  await writeFile(auditPath, JSON.stringify(audits, null, 2));
  await testInfo.attach('seo-audit', { path: auditPath, contentType: 'application/json' });

  for (const audit of audits) {
    const expectedUrl = audit.path === '/' ? SITE : `${SITE}${audit.path}`;
    const where = `${audit.path}`;
    expect(audit.status, `${where} status`).toBe(200);
    expect(audit.titleInHead, `${where} <title> must be in <head>`).toBe(true);
    expect(audit.title.length, `${where} title length`).toBeGreaterThan(10);
    expect(audit.title.length, `${where} title length`).toBeLessThanOrEqual(75);
    expect(audit.description, `${where} description`).not.toBeNull();
    expect(audit.description?.length ?? 0, `${where} description length`).toBeGreaterThanOrEqual(
      50
    );
    expect(audit.description?.length ?? 0, `${where} description length`).toBeLessThanOrEqual(
      160
    );
    expect(audit.canonicalInHead, `${where} canonical must be in <head>`).toBe(true);
    expect(audit.canonical, `${where} canonical`).toBe(expectedUrl);
    expect(audit.ogUrl, `${where} og:url`).toBe(expectedUrl);
    expect(audit.ogImage, `${where} og:image`).toMatch(/^https?:\/\//);
    expect(audit.robots ?? '', `${where} must be indexable`).not.toMatch(/noindex/);
    expect(audit.h1Count, `${where} h1 count`).toBe(1);
    expect(audit.jsonLdErrors, `${where} JSON-LD must parse`).toEqual([]);
    expect(audit.jsonLdMissingNonce, `${where} JSON-LD must carry the CSP nonce`).toBe(0);
    expect(audit.jsonLdTypes, `${where} JSON-LD`).toContain('WebSite');
    expect(
      audit.jsonLdTypes.some((type) => type === 'WebPage' || type === 'CollectionPage'),
      `${where} JSON-LD must describe the page itself`
    ).toBe(true);
  }

  const titles = audits.map((audit) => audit.title);
  expect(new Set(titles).size, 'titles must be unique').toBe(titles.length);
  const descriptions = audits.map((audit) => audit.description);
  expect(new Set(descriptions).size, 'descriptions must be unique').toBe(descriptions.length);

  await page.context().close();
});

test('AI crawlers that do not run JavaScript still get metadata in <head>', async ({
  browser,
}) => {
  const page = await openCrawlerPage(browser, CRAWLER_IPS.gptbot, GPTBOT_UA);
  const audit = await auditPage(page, '/concurso/3005');
  expect(audit.status).toBe(200);
  expect(audit.titleInHead).toBe(true);
  expect(audit.canonicalInHead).toBe(true);
  expect(audit.h1).toContain('3005');
  await page.context().close();
});

test.describe('draw pages', () => {
  test('a draw with a winner answers the query first and links its neighbours', async ({
    page,
  }) => {
    const response = await page.goto('/concurso/3005');
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/Resultado da Mega-Sena 3005 \(10\/05\/2026\)/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Resultado da Mega-Sena 3005'
    );
    const summary = page.getByTestId('answer-summary');
    await expect(summary).toContainText('10/05/2026');
    await expect(summary).toContainText('07, 15, 24, 33, 42 e 60');
    await expect(summary).toContainText('1 aposta acertou as seis dezenas');

    const prizes = page.getByRole('table', { name: /Premiação do concurso 3005/ });
    await expect(prizes.getByRole('row', { name: /Sena/ })).toContainText('R$ 2.000.000,00');
    await expect(prizes.getByRole('row', { name: /Quina/ })).toContainText('80');
    await expect(prizes.getByRole('row', { name: /Quina/ })).toContainText('R$ 45.000,00');
    await expect(prizes.getByRole('row', { name: /Quadra/ })).toContainText('6.000');
    await expect(prizes.getByRole('row', { name: /Quadra/ })).toContainText('R$ 900,00');

    await expect(definitionFor(page, 'Soma das dezenas')).toHaveText('181');
    await expect(definitionFor(page, 'Pares e ímpares')).toHaveText('3 pares · 3 ímpares');
    await expect(definitionFor(page, 'Baixas e altas')).toHaveText('3 baixas · 3 altas');
    await expect(definitionFor(page, 'Números primos')).toHaveText('1 (07)');
    await expect(definitionFor(page, 'Repetidas do concurso anterior')).toHaveText('Nenhuma');

    for (const number of [7, 15, 24, 33, 42, 60]) {
      await expect(page.locator(`main a[href="/numeros/${number}"]`).first()).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /Concurso anterior.*3004/ })).toHaveAttribute(
      'href',
      '/concurso/3004'
    );
    await expect(page.getByRole('link', { name: /Próximo concurso.*3006/ })).toHaveAttribute(
      'href',
      '/concurso/3006'
    );
    await expect(
      page.getByRole('navigation', { name: 'Trilha de navegação' }).getByRole('link', {
        name: '2026',
      })
    ).toHaveAttribute('href', '/resultados/2026');
  });

  test('the latest accumulated draw shows the rollover and has no next link', async ({ page }) => {
    await page.goto('/concurso/3006');
    await expect(page.getByTestId('answer-summary')).toContainText('Acumulou');
    await expect(page.getByTestId('answer-summary')).toContainText('R$ 10.000.000,00');
    await expect(
      page.getByRole('table', { name: /Premiação do concurso 3006/ }).getByRole('row', {
        name: /Sena/,
      })
    ).toContainText('Acumulou');
    await expect(page.getByRole('link', { name: /Próximo concurso/ })).toHaveCount(0);
  });

  test('a draw has a data-driven social image', async ({ page, request }) => {
    await page.goto('/concurso/3005');
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toContain('/concurso/3005/');
    const image = await request.get(new URL(ogImage ?? '').pathname + new URL(ogImage ?? '').search);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');
  });

  test('breadcrumb structured data mirrors the visible trail', async ({ page }) => {
    await page.goto('/concurso/3005');
    const graphs = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent ?? '{}')));
    const nodes = graphs.flatMap((graph) => (graph['@graph'] as unknown[]) ?? [graph]) as Array<
      Record<string, unknown>
    >;
    const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList');
    const items = (breadcrumb?.['itemListElement'] as Array<Record<string, unknown>>) ?? [];
    expect(items.map((item) => item['name'])).toEqual([
      'Início',
      'Resultados',
      '2026',
      'Concurso 3005',
    ]);
    expect(items.at(-1)?.['item']).toBe(`${SITE}/concurso/3005`);

    // The page's own dateModified agrees with its sitemap lastmod.
    const webPage = nodes.find((node) => node['@type'] === 'WebPage');
    expect(webPage?.['datePublished']).toBe('2026-05-10');
    expect(webPage?.['dateModified']).toBe('2026-05-21T01:30:00.000Z');
  });
});

test.describe('number pages', () => {
  test('a drawn number reports frequency, delay and appearances', async ({ page }) => {
    const response = await page.goto('/numeros/18');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Número 18 da Mega-Sena/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Número 18 na Mega-Sena');
    const summary = page.getByTestId('answer-summary');
    await expect(summary).toContainText('saiu 2 vezes em 6 concursos');
    await expect(summary).toContainText('concurso 3006');
    await expect(summary).toContainText('12/05/2026');

    await expect(page.getByText('Dados até o concurso 3006 (12/05/2026)')).toBeVisible();
    await expect(definitionFor(page, 'Posição no ranking')).toHaveText('1º de 60');
    await expect(definitionFor(page, 'Atraso atual')).toHaveText('0 concursos');

    const appearances = page.getByRole('table', { name: /Últimas vezes que o 18 saiu/ });
    await expect(appearances.getByRole('link', { name: '3006' })).toHaveAttribute(
      'href',
      '/concurso/3006'
    );
    await expect(appearances.getByRole('link', { name: '3002' })).toHaveAttribute(
      'href',
      '/concurso/3002'
    );
    await expect(page.getByRole('link', { name: /Número 17/ })).toHaveAttribute(
      'href',
      '/numeros/17'
    );
    await expect(page.getByRole('link', { name: /Número 19/ })).toHaveAttribute(
      'href',
      '/numeros/19'
    );
  });

  test('a number that was never drawn says so instead of inventing stats', async ({ page }) => {
    const response = await page.goto('/numeros/5');
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('answer-summary')).toContainText(
      'ainda não saiu em nenhum dos 6 concursos'
    );
  });

  test('the numbers hub links all sixty numbers', async ({ page }) => {
    await page.goto('/numeros');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Números da Mega-Sena de 1 a 60'
    );
    for (let number = 1; number <= 60; number++) {
      await expect(page.locator(`main a[href="/numeros/${number}"]`).first()).toBeAttached();
    }
    await expect(page.getByTestId('answer-summary')).toContainText('18');
  });
});

test.describe('results archive', () => {
  test('the results hub shows the latest draw and every year', async ({ page }) => {
    await page.goto('/resultados');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Resultados da Mega-Sena');
    await expect(page.getByTestId('answer-summary')).toContainText('3006');
    await expect(page.locator('main a[href="/concurso/3006"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/resultados/2026"]').first()).toBeVisible();

    const graphs = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent ?? '{}')));
    const dataset = graphs
      .flatMap((graph) => (graph['@graph'] as Array<Record<string, unknown>>) ?? [graph])
      .find((node) => node['@type'] === 'Dataset');
    // Last modification of the data, not the date of the last draw (2026-05-12).
    expect(dataset?.['dateModified']).toBe('2026-05-21T01:30:00.000Z');
    expect(dataset?.['temporalCoverage']).toBe('2026-05-02/2026-05-12');
  });

  test('a year page lists every draw of that year', async ({ page }) => {
    await page.goto('/resultados/2026');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Resultados da Mega-Sena em 2026'
    );
    await expect(page.getByTestId('answer-summary')).toContainText('6 concursos');
    const table = page.getByRole('table', { name: /Concursos de 2026/ });
    for (const contest of SEEDED_CONTESTS) {
      await expect(table.getByRole('link', { name: String(contest), exact: true })).toHaveAttribute(
        'href',
        `/concurso/${contest}`
      );
    }
  });
});

test('archive links are not prefetched, so a visit does not spend the API quota', async ({
  browser,
}) => {
  // Archive pages have no loading boundary (for real 404s), so a viewport
  // prefetch would render each linked page and call the API once per link:
  // one visit to /numeros would cost 60+ calls of the visitor's 100/min.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'X-Forwarded-For': '203.0.113.20' },
  });
  const page = await context.newPage();
  const archivePrefetches: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.searchParams.has('_rsc') &&
      /^\/(numeros|concurso|resultados)(\/|$)/.test(url.pathname)
    ) {
      archivePrefetches.push(url.pathname);
    }
  });

  for (const path of ['/numeros', '/resultados/2026', '/concurso/3005', '/', '/dashboard']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(500);
  }
  expect(archivePrefetches).toEqual([]);

  // Links still navigate on click.
  await page.goto('/numeros');
  await page.getByRole('link', { name: 'Estatísticas do número 18' }).first().click();
  await expect(page).toHaveURL(/\/numeros\/18$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Número 18 na Mega-Sena');
  await context.close();
});

test.describe('freshness and crawl plumbing', () => {
  test('crawl files use a short Cloudflare edge TTL so data refreshes show up fast', async ({
    request,
  }) => {
    for (const path of ['/robots.txt', '/sitemap.xml', '/llms.txt']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['cloudflare-cdn-cache-control'], path).toBe('max-age=600');
    }
  });

  test('the IndexNow key file serves the configured key as plain text', async ({ request }) => {
    const response = await request.get('/indexnow-key.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^text\/plain/);
    expect((await response.text()).trim()).toBe('e2e-indexnow-key-0123456789abcdef');
  });
});

test.describe('search-intent content', () => {
  test('the results hub announces the next contest with CAIXA figures', async ({ page }) => {
    await page.goto('/resultados');
    // Freshness in Brasília time: the last load was 22:30 on 20/05 there.
    await expect(
      page.getByText('Dados até o concurso 3006 (12/05/2026), base atualizada em 20/05/2026')
    ).toBeVisible();
    const next = page.getByRole('region', { name: 'Próximo concurso' });
    await expect(next).toContainText('Concurso 3007');
    await expect(next).toContainText('R$ 10.000.000,00');
    await expect(next).toContainText('R$ 5.000.000,00');
    await expect(next).toContainText('estimativa da CAIXA');
  });

  test('the numbers hub ranks the most drawn and the most overdue numbers', async ({ page }) => {
    await page.goto('/numeros');
    const mostDrawn = page.getByRole('list', { name: 'Números mais sorteados' });
    await expect(mostDrawn.getByRole('listitem').first()).toContainText('1º');
    await expect(mostDrawn.getByRole('listitem').first()).toContainText('18');
    await expect(mostDrawn.getByRole('listitem').first()).toContainText('2 vezes');
    // Ties share a position, like the ranking on each number page.
    await expect(mostDrawn.getByRole('listitem').nth(1)).toContainText('2º');
    await expect(mostDrawn.getByRole('listitem').nth(2)).toContainText('2º');
    // A number never drawn is the most overdue of all.
    const overdue = page.getByRole('list', { name: 'Números mais atrasados' });
    await expect(overdue.getByRole('listitem').first()).toContainText('05');
    await expect(overdue.getByRole('listitem').first()).toContainText('nunca sorteado');
    await expect(page.getByText('O atraso não muda a chance do próximo sorteio')).toBeVisible();
  });

  test('a draw summary leads with its longest comeback', async ({ page }) => {
    await page.goto('/concurso/3006');
    await expect(page.getByTestId('answer-summary')).toContainText(
      'A dezena 18 voltou depois de 3 concursos sem sair.'
    );
  });

  test('trust signals: 18+ notice, official help, corrections policy and payout share', async ({
    page,
  }) => {
    await page.goto('/about');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('proibidas para menores de 18 anos');
    await expect(footer.getByRole('link', { name: /Jogo Responsável/ })).toHaveAttribute(
      'href',
      'https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/jogo-responsavel'
    );
    await expect(page.getByRole('heading', { name: 'Correções' })).toBeVisible();
    await expect(page.getByText(/43,79% da arrecadação/)).toBeVisible();
  });
});

test('site navigation and existing pages link into the programmatic pages', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.getByRole('link', { name: 'Resultados' })).toHaveAttribute(
    'href',
    '/resultados'
  );
  await expect(nav.getByRole('link', { name: 'Números' })).toHaveAttribute('href', '/numeros');
  await expect(page.locator('main a[href="/concurso/3006"]').first()).toBeVisible();

  await page.goto('/dashboard');
  await expect(page.locator('main a[href="/concurso/3005"]').first()).toBeVisible();
  await expect(page.locator('main a[href="/numeros/18"]').first()).toBeVisible();
});
