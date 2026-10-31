/**
 * Full-page PNG screenshots for the pixel-diff gate, through agent-browser
 * (headless Chromium), with an optional Worker version override per arm.
 *
 *   bun run scripts/perf/pixel-capture.ts --label <run> --arms current,current,<candidate-id>
 *     [--base https://...] [--paths /,/about] [--gap-ms 12000]
 *
 * Each page is captured at 375 px DPR 2 and 1440 px DPR 1, light scheme and
 * reduced motion, after the network is idle and document.fonts.ready resolved.
 * Arms run interleaved, each in its own browser session, so one arm's cached
 * fonts or assets cannot mask a loading failure in another; two `current` arms
 * give the A/A noise floor. Images go to
 * .scratch/perf/<run>/pixels/; compare them with scripts/perf/pixel_diff.py.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parsePositiveIntegerArg } from '../cli-args';
import { type AssetStatus, HARNESS_USER_AGENT, PAGE_MATRIX, assertExpectedStatus, assertRequiredAssetsLoaded, resolveBaseUrl, stringArg } from './matrix';

const VIEWPORTS = [
  { name: 'm375x2', width: 375, height: 812, scale: 2 },
  { name: 'd1440x1', width: 1440, height: 900, scale: 1 },
] as const;

async function browser(session: string, ...args: string[]): Promise<string> {
  const proc = Bun.spawn(['agent-browser', '--session', session, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`agent-browser ${args[0]} saiu com ${code}: ${(err || out).trim().slice(-400)}`);
  return out.trim();
}

const ASSET_STATUS_SCRIPT = `JSON.stringify([
  ...performance.getEntriesByType("resource").filter(e => e.name.startsWith(location.origin)).map(e => {
    const url = new URL(e.name);
    const file = url.pathname;
    const type = /\\.woff2?$/.test(file) ? "Font" : /\\.css$/.test(file) ? "Stylesheet" : /\\.m?js$/.test(file) ? "Script" : "Other";
    return { path: file + url.search, type, status: e.responseStatus };
  }),
  ...[...document.fonts].filter(f => f.status === "error").map(f => ({ path: "FontFace " + f.family, type: "Font" })),
])`;

/** agent-browser prints an eval result as JSON; a string result arrives quoted once more. */
export function parseEvalJson(out: string): AssetStatus[] {
  let value: unknown = JSON.parse(out);
  if (typeof value === 'string') value = JSON.parse(value);
  if (!Array.isArray(value)) throw new Error('eval de recursos não devolveu uma lista; execução inválida.');
  return value as AssetStatus[];
}

/**
 * Every capture lands in a directory no earlier run wrote to, so the
 * existence check after each screenshot cannot be satisfied by a stale PNG.
 */
export function assertFreshOutputDir(dir: string): void {
  if (existsSync(dir)) throw new Error(`${dir} já existe de uma execução anterior; use um --label novo.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const base = resolveBaseUrl(args);
  const label = stringArg(args, '--label', 'adhoc');
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(label)) throw new Error('--label aceita apenas [a-z0-9._-].');
  const arms = stringArg(args, '--arms', 'current,current').split(',');
  const script = stringArg(args, '--script', 'megasena-analyser');
  const gapMs = parsePositiveIntegerArg(args, '--gap-ms') ?? 12000;
  const only = args.includes('--paths') ? stringArg(args, '--paths', '').split(',') : null;
  const entries = PAGE_MATRIX.filter(entry => (only ? only.includes(entry.path) : entry.lab));
  const outDir = path.join('.scratch/perf', label, 'pixels');
  assertFreshOutputDir(outDir);
  mkdirSync(outDir, { recursive: true });
  const sessions = arms.map((_arm, index) => `perf-pixels-${label}-${index}`);
  const captures = [];
  try {
    for (const session of sessions) await browser(session, 'set', 'media', 'light', 'reduced-motion');
    for (const viewport of VIEWPORTS) {
      for (const session of sessions) {
        await browser(session, 'set', 'viewport', String(viewport.width), String(viewport.height), String(viewport.scale));
      }
      for (const entry of entries) {
        for (const [index, arm] of arms.entries()) {
          const session = sessions[index]!;
          const headers: Record<string, string> = { 'X-Perf-Harness': HARNESS_USER_AGENT };
          if (arm !== 'current') headers['Cloudflare-Workers-Version-Overrides'] = `${script}="${arm}"`;
          await browser(session, 'set', 'headers', JSON.stringify(headers));
          await browser(session, 'open', `${base}${entry.path}`);
          await browser(session, 'wait', '--load', 'networkidle');
          await browser(session, 'wait', '--fn', 'document.fonts.status === "loaded"');
          // Status of the document itself, so a block or error page is never captured as a sample.
          const status = await browser(session, 'eval', 'performance.getEntriesByType("navigation")[0]?.responseStatus ?? 0');
          assertExpectedStatus(entry, Number(status.replace(/\D/g, '')));
          // document.fonts.status === "loaded" also holds when a face failed, so read
          // each same-origin asset's status and every errored FontFace.
          assertRequiredAssetsLoaded(entry.path, parseEvalJson(await browser(session, 'eval', ASSET_STATUS_SCRIPT)));
          const file = path.join(outDir, `${viewport.name}${entry.path.replace(/\W+/g, '_') || '_root'}-${index}.png`);
          // Absolute path: agent-browser reads a leading `.` (as in `.scratch/`) as a CSS
          // selector and silently saves to its own temp directory instead.
          const saved = await browser(session, 'screenshot', '--full', path.resolve(file));
          if (!existsSync(file)) throw new Error(`screenshot não gravado em ${file}: ${saved.slice(-200)}`);
          captures.push({ viewport: viewport.name, path: entry.path, arm: `${index}:${arm}`, file });
          process.stderr.write(`${viewport.name} ${entry.path} arm ${index}\n`);
          await Bun.sleep(gapMs);
        }
      }
    }
  } finally {
    for (const session of sessions) await browser(session, 'close').catch(() => '');
  }
  writeFileSync(path.join(outDir, 'captures.json'), `${JSON.stringify({ base, arms, captures }, null, 1)}\n`);
}

if (import.meta.main) await main();
