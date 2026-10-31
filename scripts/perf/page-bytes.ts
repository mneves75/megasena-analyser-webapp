/**
 * Initial page weight per matrix URL: the HTML document plus every asset the
 * document references before any script runs (stylesheets, scripts,
 * modulepreload, preloads in markup and in the Link header). Each unique asset
 * is fetched once; transfer bytes are what crossed the wire with
 * `Accept-Encoding: br, gzip`, decoded bytes are after decompression.
 *
 *   bun run scripts/perf/page-bytes.ts --label baseline [--base https://...] [--rate 60]
 *
 * Requests started later by scripts (dynamic imports, RSC fetches) belong to L3.
 * `nonAsciiCodepoints` lists every code point above U+007F in the decoded HTML
 * (markup, text and inline payload), the input for font subset coverage.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { parsePositiveIntegerArg } from '../cli-args';
import { HARNESS_USER_AGENT, MAX_REQUESTS_PER_RUN, PAGE_MATRIX, resolveBaseUrl, stringArg } from './matrix';

export type AssetKind = 'css' | 'js' | 'font' | 'image' | 'other';

export interface AssetRef {
  url: string;
  kind: AssetKind;
  /** How the document asks for it. */
  via: 'stylesheet' | 'script' | 'modulepreload' | 'preload' | 'link-header-preload';
}

function kindOf(url: string, as?: string): AssetKind {
  if (as === 'font' || /\.woff2?(?:\?|$)/.test(url)) return 'font';
  if (as === 'style' || /\.css(?:\?|$)/.test(url)) return 'css';
  if (as === 'script' || /\.m?js(?:\?|$)/.test(url)) return 'js';
  if (as === 'image' || /\.(?:png|jpe?g|webp|avif|svg|ico)(?:\?|$)/.test(url)) return 'image';
  return 'other';
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)?.slice(1).find(v => v !== undefined);
}

/** Assets requested by the markup and the Link header, deduplicated by URL. */
export function extractAssets(html: string, linkHeader: string | null, pageUrl: string): AssetRef[] {
  const found = new Map<string, AssetRef>();
  const add = (href: string | undefined, via: AssetRef['via'], as?: string) => {
    if (!href || href.startsWith('data:')) return;
    const url = new URL(href.replaceAll('&amp;', '&'), pageUrl).href;
    if (!found.has(url)) found.set(url, { url, kind: kindOf(url, as), via });
  };
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, 'rel')?.toLowerCase() ?? '';
    if (rel.split(/\s+/).includes('stylesheet')) add(attribute(tag, 'href'), 'stylesheet', 'style');
    else if (rel === 'modulepreload') add(attribute(tag, 'href'), 'modulepreload', 'script');
    else if (rel === 'preload') add(attribute(tag, 'href'), 'preload', attribute(tag, 'as'));
  }
  for (const tag of html.match(/<script\b[^>]*\ssrc=[^>]*>/gi) ?? []) add(attribute(tag, 'src'), 'script', 'script');
  for (const part of linkHeader?.split(/,(?=\s*<)/) ?? []) {
    const match = /<([^>]+)>(.*)/.exec(part.trim());
    if (!match || !/rel=("?)preload\1/i.test(match[2]!)) continue;
    add(match[1], 'link-header-preload', /as=("?)([a-z]+)\1/i.exec(match[2]!)?.[2]);
  }
  return [...found.values()];
}

interface Fetched { status: number; transferBytes: number; decodedBytes: number; body: string; link: string | null; encoding: string }

export function nonAsciiCodepoints(text: string): string[] {
  const points = new Set<number>();
  for (const char of text) {
    const point = char.codePointAt(0)!;
    if (point > 0x7f) points.add(point);
  }
  return [...points].sort((a, b) => a - b).map(point => `U+${point.toString(16).toUpperCase().padStart(4, '0')}`);
}

let sent = 0;
let ratePerMinute = 60;
let lastRequestAt = 0;

async function get(url: string, scratch: string): Promise<Fetched> {
  sent += 1;
  if (sent > MAX_REQUESTS_PER_RUN) throw new Error('Limite de requisições excedido.');
  const wait = lastRequestAt + 60000 / ratePerMinute - Date.now();
  if (wait > 0) await Bun.sleep(wait);
  lastRequestAt = Date.now();
  const bodyFile = path.join(scratch, 'body.bin');
  const proc = Bun.spawn(['curl', '-sS', '-A', HARNESS_USER_AGENT, '-H', 'Accept-Encoding: br, gzip',
    '-o', bodyFile, '-w', '%{http_code}\t%{size_download}\t%header{content-encoding}\t%header{link}', url],
  { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`curl ${url}: ${err.trim()}`);
  const [status, size, encoding, link] = out.split('\t');
  if (status === '429') throw new Error('HTTP 429 da regra de rate limit da zona; execução inválida.');
  const raw = Buffer.from(await Bun.file(bodyFile).arrayBuffer());
  const decoded = encoding === 'br' ? brotliDecompressSync(raw) : encoding === 'gzip' ? gunzipSync(raw) : raw;
  return { status: Number(status), transferBytes: Number(size), decodedBytes: decoded.length,
    body: decoded.toString('utf8'), link: link || null, encoding: encoding || 'identity' };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const base = resolveBaseUrl(args);
  const label = stringArg(args, '--label', 'adhoc');
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(label)) throw new Error('--label aceita apenas [a-z0-9._-].');
  ratePerMinute = parsePositiveIntegerArg(args, '--rate') ?? ratePerMinute;
  const outDir = path.join('docs/perf/raw', label);
  const scratch = path.join('.scratch/perf', label);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(scratch, { recursive: true });

  const assetCache = new Map<string, Omit<Fetched, 'body' | 'link'>>();
  const pages = [];
  for (const entry of PAGE_MATRIX) {
    const url = `${base}${entry.path}`;
    const page = await get(url, scratch);
    const isHtml = /<html[\s>]/i.test(page.body);
    const refs = isHtml ? extractAssets(page.body, page.link, url).filter(ref => ref.url.startsWith(base)) : [];
    const assets: (AssetRef & { path: string } & Omit<Fetched, 'body' | 'link'>)[] = [];
    for (const ref of refs) {
      if (!assetCache.has(ref.url)) {
        const { body: _body, link: _link, ...meta } = await get(ref.url, scratch);
        assetCache.set(ref.url, meta);
      }
      assets.push({ ...ref, path: ref.url.slice(base.length), ...assetCache.get(ref.url)! });
    }
    const byKind = (kind: AssetKind) => assets.filter(asset => asset.kind === kind);
    const sum = (list: { transferBytes: number }[]) => list.reduce((total, item) => total + item.transferBytes, 0);
    pages.push({
      path: entry.path, routeClass: entry.routeClass, status: page.status,
      html: { transferBytes: page.transferBytes, decodedBytes: page.decodedBytes, encoding: page.encoding },
      requests: 1 + assets.length,
      transferBytes: { html: page.transferBytes, css: sum(byKind('css')), js: sum(byKind('js')), font: sum(byKind('font')),
        image: sum(byKind('image')), other: sum(byKind('other')), total: page.transferBytes + sum(assets) },
      fontPreloads: byKind('font').map(asset => asset.path),
      nonAsciiCodepoints: nonAsciiCodepoints(page.body),
      assets: assets.map(({ url: _url, ...rest }) => rest),
    });
    process.stderr.write(`${entry.path} ok (${sent} requisições)\n`);
  }
  writeFileSync(path.join(outDir, 'page-bytes.json'), `${JSON.stringify({
    tool: 'scripts/perf/page-bytes.ts', measuredAt: new Date().toISOString(), base, requestsSent: sent,
    userAgent: HARNESS_USER_AGENT, pages,
  }, null, 1)}\n`);
  console.log('| path | status | requests | HTML | CSS | JS | font | total (transfer bytes) | font preloads |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const page of pages) {
    const t = page.transferBytes;
    console.log(`| ${page.path} | ${page.status} | ${page.requests} | ${t.html} | ${t.css} | ${t.js} | ${t.font} | ${t.total} | ${page.fontPreloads.length} |`);
  }
}

if (import.meta.main) await main();
