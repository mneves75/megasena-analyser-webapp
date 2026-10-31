/**
 * Page matrix and traffic rules shared by the performance harness.
 * Public, anonymous GET pages only: the app has no authenticated state.
 * `/api/*` is excluded because every API read writes audit and log rows.
 */
export const HARNESS_USER_AGENT = 'megasena-perf-harness/1 (+https://github.com/mneves75/megasena-analyser-webapp/tree/main/docs/perf)';

/** Hard ceiling of HTTP requests a single harness invocation may send. */
export const MAX_REQUESTS_PER_RUN = 3000;

/** Lab runs must not reach the field-data beacon. */
export const RUM_BLOCK_PATTERNS = ['static.cloudflareinsights.com', '*/cdn-cgi/rum*'];

export type RouteClass =
  | 'worker-dynamic'   // rendered on every request, reads the data object
  | 'worker-static'    // rendered on every request, no data read
  | 'edge-cached-html' // archive HTML stored in the Worker Cache API
  | 'edge-cached-file' // social images and crawler indexes in the Cache API
  | 'static-asset'     // served by Workers Static Assets, no invocation
  | 'not-found';

export interface MatrixEntry {
  path: string;
  label: string;
  routeClass: RouteClass;
  /** Included in the browser (L3) lab subset. */
  lab?: boolean;
}

export const PAGE_MATRIX: readonly MatrixEntry[] = [
  { path: '/', label: 'home', routeClass: 'worker-dynamic', lab: true },
  { path: '/dashboard', label: 'dashboard', routeClass: 'worker-dynamic' },
  { path: '/dashboard/statistics', label: 'statistics (slowest wall time)', routeClass: 'worker-dynamic', lab: true },
  { path: '/dashboard/generator', label: 'generator form', routeClass: 'worker-dynamic', lab: true },
  { path: '/resultados', label: 'archive index', routeClass: 'worker-dynamic' },
  { path: '/resultados/2026', label: 'year archive, current (heaviest HTML)', routeClass: 'edge-cached-html', lab: true },
  { path: '/resultados/1996', label: 'year archive, first year', routeClass: 'edge-cached-html' },
  { path: '/concurso/3079', label: 'contest, recent', routeClass: 'edge-cached-html', lab: true },
  { path: '/concurso/1', label: 'contest, first', routeClass: 'edge-cached-html' },
  { path: '/numeros', label: 'numbers index', routeClass: 'worker-dynamic' },
  { path: '/numeros/10', label: 'number profile', routeClass: 'edge-cached-html' },
  { path: '/mega-da-virada', label: 'Mega da Virada', routeClass: 'worker-dynamic' },
  { path: '/about', label: 'about (static text)', routeClass: 'worker-static', lab: true },
  { path: '/privacy', label: 'privacy (static text)', routeClass: 'worker-static' },
  { path: '/terms', label: 'terms (static text)', routeClass: 'worker-static' },
  { path: '/perf-harness-pagina-inexistente', label: '404 page', routeClass: 'not-found' },
  { path: '/robots.txt', label: 'robots.txt', routeClass: 'worker-static' },
  { path: '/sitemap.xml', label: 'sitemap', routeClass: 'edge-cached-file' },
  { path: '/opengraph-image', label: 'site social image', routeClass: 'edge-cached-file' },
  { path: '/manifest.json', label: 'manifest (public file)', routeClass: 'static-asset' },
];

/**
 * A blocked, failed or challenge response can be faster and smaller than the
 * real page, so any status other than the route's own invalidates the run.
 * Only the deliberate 404 probe expects 404.
 */
export function assertExpectedStatus(entry: MatrixEntry, status: number): void {
  const expected = entry.routeClass === 'not-found' ? 404 : 200;
  if (status !== expected) {
    throw new Error(`HTTP ${status} em ${entry.path} (esperado ${expected}); execução inválida.`
      + (status === 429 ? ' Regra de rate limit da zona: reduza a taxa e repita.' : ''));
  }
}

export interface AssetStatus { path: string; type?: string; status?: number }

const REQUIRED_ASSET_TYPES = new Set(['Script', 'Stylesheet', 'Font']);

/**
 * A browser sample whose scripts, stylesheets or fonts failed looks like a
 * smaller, faster page, so it is rejected. Completed redirects and revalidations
 * (3xx) count as loaded; a missing or network-failed status does not. Judged per
 * URL: Chromium also lists a deduplicated modulepreload hint as a second entry
 * with status 0 next to the real 200 fetch of the same file.
 */
export function assertRequiredAssetsLoaded(pagePath: string, assets: AssetStatus[]): void {
  const loaded = (asset: AssetStatus) => typeof asset.status === 'number' && asset.status >= 200 && asset.status < 400;
  const loadedPaths = new Set(assets.filter(loaded).map(asset => asset.path));
  const failed = assets.filter(asset => REQUIRED_ASSET_TYPES.has(asset.type ?? '') && !loadedPaths.has(asset.path));
  if (failed.length > 0) {
    const sample = failed.slice(0, 3).map(asset => `${asset.status ?? 'sem status'} ${asset.path}`).join(', ');
    throw new Error(`${failed.length} recurso(s) obrigatório(s) falharam em ${pagePath} (${sample}); execução inválida.`);
  }
}

export function resolveBaseUrl(args: string[]): string {
  const index = args.indexOf('--base');
  const raw = index === -1 ? 'https://megasena-analyzer.com.br' : args[index + 1];
  if (typeof raw !== 'string' || !/^https?:\/\/[^/]+$/.test(raw)) {
    throw new Error('--base deve ser uma origem sem caminho, por exemplo https://example.com');
  }
  return raw;
}

export function stringArg(args: string[], flag: string, fallback: string): string {
  const index = args.indexOf(flag);
  const value = index === -1 ? fallback : args[index + 1];
  if (typeof value !== 'string' || value.startsWith('--')) throw new Error(`${flag} exige um valor.`);
  return value;
}
