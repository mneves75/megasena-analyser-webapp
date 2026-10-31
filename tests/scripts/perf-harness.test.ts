import { describe, expect, it } from 'vitest';
import { percentile, summarize } from '../../scripts/perf/stats';
import { extractAssets, nonAsciiCodepoints } from '../../scripts/perf/page-bytes';
import { parseWriteOut } from '../../scripts/perf/l2-ttfb';
import { PAGE_MATRIX, assertExpectedStatus, assertRequiredAssetsLoaded } from '../../scripts/perf/matrix';
import { mkdtempSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertFreshOutputDir, parseEvalJson } from '../../scripts/perf/pixel-capture';
import { labAssets, lighthouseFailure, networkPath } from '../../scripts/perf/l3-lab';

describe('perf harness statistics', () => {
  it('uses nearest-rank percentiles on sorted samples', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(100);
    expect(percentile(sorted, 0)).toBe(10);
    expect(() => percentile([], 50)).toThrow();
  });

  it('summarizes unsorted values with spread', () => {
    const summary = summarize([5, 1, 4, 2, 3]);
    expect(summary).toMatchObject({ n: 5, min: 1, p50: 3, max: 5, p25: 2, p75: 4, iqr: 2 });
  });
});

describe('perf harness page assets', () => {
  it('collects stylesheets, scripts, preloads and Link header preloads once each', () => {
    const html = `<html><head>
      <link rel="stylesheet" href="/_next/static/css/a.css" data-precedence="x">
      <link rel="modulepreload" href="/_next/static/chunks/b.js">
      <link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/c.woff2">
      <script async src="/_next/static/chunks/b.js"></script>
      <script nonce="n">inline()</script>
      <link rel="icon" href="/icon">
    </head></html>`;
    const header = '</_next/static/css/a.css>; rel=preload; as="style", </fonts/d.woff2>; rel=preload; as=font; crossorigin';
    const assets = extractAssets(html, header, 'https://example.com/page');
    expect(assets.map(asset => [new URL(asset.url).pathname, asset.kind, asset.via])).toEqual([
      ['/_next/static/css/a.css', 'css', 'stylesheet'],
      ['/_next/static/chunks/b.js', 'js', 'modulepreload'],
      ['/fonts/c.woff2', 'font', 'preload'],
      ['/fonts/d.woff2', 'font', 'link-header-preload'],
    ]);
  });
});

describe('perf harness code points', () => {
  it('lists unique non-ASCII code points, including astral ones, in order', () => {
    expect(nonAsciiCodepoints('São Paulo — ação ≥ 6 \u{1F600}a')).toEqual(['U+00E3', 'U+00E7', 'U+2014', 'U+2265', 'U+1F600']);
  });
});

describe('perf harness curl output', () => {
  it('parses one write-out line into milliseconds and the colo', () => {
    const sample = parseWriteOut('200\t2\t0.001\t0.040\t0.090\t0.1755\t0.2\t1234\t0\tHIT\tHIT\ta5322816581d4e89-GIG',
      { path: '/x', arm: '0:current', mode: 'warm' });
    expect(sample).toMatchObject({ code: 200, ttfbMs: 175.5, connects: 0, cfCacheStatus: 'HIT', colo: 'GIG', bytes: 1234 });
  });

  it('rejects malformed lines instead of recording a sample', () => {
    expect(() => parseWriteOut('200\t2', { path: '/x', arm: '0:current', mode: 'new' })).toThrow();
  });
});

describe('perf page matrix', () => {
  it('rejects any response other than the route class status, so error pages never become samples', () => {
    const page = PAGE_MATRIX.find(entry => entry.routeClass === 'worker-static')!;
    const missing = PAGE_MATRIX.find(entry => entry.routeClass === 'not-found')!;
    expect(() => assertExpectedStatus(page, 200)).not.toThrow();
    expect(() => assertExpectedStatus(missing, 404)).not.toThrow();
    for (const status of [403, 404, 429, 500, 503, 301]) {
      expect(() => assertExpectedStatus(page, status)).toThrow(/execução inválida/);
    }
    expect(() => assertExpectedStatus(missing, 200)).toThrow(/execução inválida/);
  });

  it('rejects a browser sample whose script, stylesheet or font failed', () => {
    const document = { path: '/', type: 'Document', status: 200 };
    const ok = [document, { path: '/a.js', type: 'Script', status: 200 }, { path: '/a.css', type: 'Stylesheet', status: 304 },
      { path: '/a.woff2', type: 'Font', status: 200 }, { path: '/old', type: 'Script', status: 301 }, { path: '/x.png', type: 'Image', status: 404 }];
    expect(() => assertRequiredAssetsLoaded('/', ok)).not.toThrow();
    // A deduplicated modulepreload hint (status 0) next to the real fetch of the same file.
    expect(() => assertRequiredAssetsLoaded('/', [...ok, { path: '/a.js', type: 'Script', status: 0 }])).not.toThrow();
    for (const bad of [{ path: '/a.woff2', type: 'Font', status: 403 }, { path: '/a.js', type: 'Script', status: 500 },
      { path: '/a.js', type: 'Script', status: -1 }, { path: '/a.css', type: 'Stylesheet', status: 0 },
      { path: 'FontFace Archivo', type: 'Font' }]) {
      expect(() => assertRequiredAssetsLoaded('/', [document, bad])).toThrow(/execução inválida/);
    }
    // A success never masks an explicit failure: same URL, another query, or another type.
    for (const mixed of [
      [{ path: '/a.js', type: 'Script', status: 200 }, { path: '/a.js', type: 'Script', status: 500 }],
      [{ path: '/app.js?v=old', type: 'Script', status: 200 }, { path: '/app.js?v=new', type: 'Script', status: 500 }],
      [{ path: '/app.js?v=old', type: 'Script', status: 200 }, { path: '/app.js?v=new', type: 'Script', status: 0 }],
      [{ path: '/a.woff2', type: 'Other', status: 200 }, { path: '/a.woff2', type: 'Font', status: 0 }],
    ]) {
      expect(() => assertRequiredAssetsLoaded('/', [document, ...mixed])).toThrow(/execução inválida/);
    }
  });

  it('ignores the blocked third-party RUM beacon in the lab network log', () => {
    const network = [{ path: '/a.js', type: 'Script', status: 200 }, { path: 'static.cloudflareinsights.com', type: 'Script', status: -1 }];
    expect(() => assertRequiredAssetsLoaded('/', network)).toThrow(/execução inválida/);
    expect(labAssets(network)).toEqual([{ path: '/a.js', type: 'Script', status: 200 }]);
    expect(() => assertRequiredAssetsLoaded('/', labAssets(network))).not.toThrow();
    expect(() => assertRequiredAssetsLoaded('/', labAssets([...network, { path: '/b.woff2', type: 'Font', status: 404 }]))).toThrow(/execução inválida/);
  });

  it('keeps same-origin requests by parsed origin, whatever the base spelling', () => {
    for (const base of ['https://example.com', 'https://example.com:443', 'https://EXAMPLE.com']) {
      expect(networkPath('https://example.com/_next/a.js?v=1', base)).toBe('/_next/a.js?v=1');
      expect(networkPath('https://static.cloudflareinsights.com/beacon.min.js', base)).toBe('static.cloudflareinsights.com');
    }
    expect(networkPath('https://example.com.evil.test/a.js', 'https://example.com')).toBe('example.com.evil.test');
  });

  it('retries only Lighthouse tool failures, never page failures', () => {
    const report = (code?: string) => JSON.stringify({ runtimeError: code ? { code } : undefined });
    expect(lighthouseFailure('', report('NO_NAVSTART'))).toBe('retry');
    expect(lighthouseFailure('Runtime error encountered: NO_NAVSTART', null)).toBe('retry');
    expect(lighthouseFailure('', report('ERRORED_DOCUMENT_REQUEST'))).toBe('fail');
    expect(lighthouseFailure('NO_NAVSTART', report('ERRORED_DOCUMENT_REQUEST'))).toBe('fail');
    expect(lighthouseFailure('', report())).toBe('fail');
    expect(lighthouseFailure('Chrome crashed', null)).toBe('fail');
    expect(lighthouseFailure('NO_NAVSTART', '{not json')).toBe('fail');
  });

  it('refuses to capture into a directory left by an earlier run', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'perf-pixels-'));
    expect(() => assertFreshOutputDir(path.join(dir, 'new'))).not.toThrow();
    expect(() => assertFreshOutputDir(dir)).toThrow(/--label/);
    rmdirSync(dir);
  });

  it('reads the asset list agent-browser prints, quoted or not', () => {
    const list = [{ path: '/a.js', type: 'Script', status: 200 }];
    expect(parseEvalJson(JSON.stringify(list))).toEqual(list);
    expect(parseEvalJson(JSON.stringify(JSON.stringify(list)))).toEqual(list);
    expect(() => parseEvalJson('"ok"')).toThrow();
  });

  it('never probes the audited API and keeps paths unique', () => {
    const paths = PAGE_MATRIX.map(entry => entry.path);
    expect(paths.some(value => value.startsWith('/api/'))).toBe(false);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
