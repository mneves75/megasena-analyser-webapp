/**
 * L3 lab browser: Lighthouse 13 mobile (simulated Slow 4G: 150 ms RTT,
 * 1.6 Mbps down, 4x CPU slowdown; Moto G Power viewport) on the matrix lab subset.
 *
 *   bun run scripts/perf/l3-lab.ts --label baseline [--runs 5] [--arms current,current]
 *     [--base https://...] [--paths /,/about] [--gap-ms 8000]
 *
 * Arms are interleaved per run (A B A B). An arm other than `current` is a Worker
 * version id, sent on every request as Cloudflare-Workers-Version-Overrides.
 * The RUM beacon is blocked so lab traffic stays out of field data. Full
 * Lighthouse reports stay in .scratch/perf/<label>/; the committed extract holds
 * metrics and the network log (URL path, type, transfer and resource bytes).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parsePositiveIntegerArg } from '../cli-args';
import { HARNESS_USER_AGENT, PAGE_MATRIX, RUM_BLOCK_PATTERNS, assertExpectedStatus, resolveBaseUrl, stringArg } from './matrix';
import { round, summarize } from './stats';

interface NetworkRequest { url: string; resourceType?: string; transferSize?: number; resourceSize?: number; statusCode?: number }

async function lighthouse(url: string, outFile: string, arm: string, script: string): Promise<void> {
  const args = [url, '--quiet', '--output=json', `--output-path=${outFile}`, '--only-categories=performance',
    '--form-factor=mobile', '--throttling-method=simulate', '--chrome-flags=--headless=new',
    ...RUM_BLOCK_PATTERNS.map(pattern => `--blocked-url-patterns=${pattern}`),
  ];
  const headers: Record<string, string> = { 'X-Perf-Harness': HARNESS_USER_AGENT };
  if (arm !== 'current') headers['Cloudflare-Workers-Version-Overrides'] = `${script}="${arm}"`;
  args.push(`--extra-headers=${JSON.stringify(headers)}`);
  const proc = Bun.spawn(['lighthouse', ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [err, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`lighthouse saiu com ${code}: ${err.trim().slice(-500)}`);
}

function extract(lhrFile: string, base: string) {
  const lhr = JSON.parse(readFileSync(lhrFile, 'utf8'));
  const audit = (id: string) => lhr.audits[id];
  const requests: NetworkRequest[] = audit('network-requests')?.details?.items ?? [];
  const observed = audit('metrics')?.details?.items?.[0] ?? {};
  const bytes = (type: string) => requests.filter(r => r.resourceType === type).reduce((sum, r) => sum + (r.transferSize ?? 0), 0);
  const blocked = requests.filter(r => r.statusCode === 429).length;
  const documentStatus = requests.find(r => r.resourceType === 'Document')?.statusCode ?? 0;
  return {
    runWarnings: lhr.runWarnings,
    lighthouseVersion: lhr.lighthouseVersion,
    userAgent: lhr.environment?.hostUserAgent,
    benchmarkIndex: lhr.environment?.benchmarkIndex,
    finalUrl: lhr.finalDisplayedUrl,
    rateLimited: blocked,
    documentStatus,
    simulated: {
      fcpMs: audit('first-contentful-paint').numericValue,
      lcpMs: audit('largest-contentful-paint').numericValue,
      tbtMs: audit('total-blocking-time').numericValue,
      cls: audit('cumulative-layout-shift').numericValue,
      speedIndexMs: audit('speed-index').numericValue,
    },
    observed: {
      ttfbMs: audit('server-response-time')?.numericValue,
      fcpMs: observed.observedFirstContentfulPaint,
      lcpMs: observed.observedLargestContentfulPaint,
      loadMs: observed.observedLoad,
    },
    longTasks: (audit('long-tasks')?.details?.items ?? []).length,
    lcpElement: audit('largest-contentful-paint-element')?.details?.items?.[0]?.items?.[0]?.node?.selector,
    requests: requests.length,
    transferBytes: {
      total: requests.reduce((sum, r) => sum + (r.transferSize ?? 0), 0),
      document: bytes('Document'), script: bytes('Script'), stylesheet: bytes('Stylesheet'),
      font: bytes('Font'), image: bytes('Image'), fetch: bytes('Fetch'), other: bytes('Other'),
    },
    fontRequests: requests.filter(r => r.resourceType === 'Font').map(r => r.url.replace(base, '')),
    network: requests.map(r => ({ path: r.url.startsWith(base) ? r.url.slice(base.length) : new URL(r.url).host,
      type: r.resourceType, status: r.statusCode, transferSize: r.transferSize, resourceSize: r.resourceSize })),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const base = resolveBaseUrl(args);
  const label = stringArg(args, '--label', 'adhoc');
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(label)) throw new Error('--label aceita apenas [a-z0-9._-].');
  const runs = parsePositiveIntegerArg(args, '--runs') ?? 5;
  const gapMs = parsePositiveIntegerArg(args, '--gap-ms') ?? 8000;
  const arms = stringArg(args, '--arms', 'current,current').split(',');
  const script = stringArg(args, '--script', 'megasena-analyser');
  const only = args.includes('--paths') ? stringArg(args, '--paths', '').split(',') : null;
  const entries = PAGE_MATRIX.filter(entry => (only ? only.includes(entry.path) : entry.lab));
  const scratch = path.join('.scratch/perf', label, 'lighthouse');
  const outDir = path.join('docs/perf/raw', label);
  mkdirSync(scratch, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const results: ({ path: string; arm: string; run: number } & ReturnType<typeof extract>)[] = [];
  for (let run = 0; run < runs; run++) {
    for (const entry of entries) {
      for (const [index, arm] of arms.entries()) {
        const file = path.join(scratch, `${entry.path.replace(/\W+/g, '_') || 'root'}-${index}-${run}.json`);
        await lighthouse(`${base}${entry.path}`, file, arm, script);
        const result = extract(file, base);
        if (result.rateLimited > 0) throw new Error(`429 em ${entry.path}: execução inválida; aumente --gap-ms.`);
        assertExpectedStatus(entry, result.documentStatus);
        results.push({ path: entry.path, arm: `${index}:${arm}`, run, ...result });
        process.stderr.write(`${entry.path} arm ${index} run ${run} LCP(sim)=${round(result.simulated.lcpMs)}\n`);
        await Bun.sleep(gapMs);
      }
    }
  }

  const summary = entries.flatMap(entry => arms.map((arm, index) => {
    const group = results.filter(r => r.path === entry.path && r.arm === `${index}:${arm}`);
    const pick = (fn: (r: typeof group[number]) => number | undefined) =>
      summarize(group.map(fn).filter((v): v is number => typeof v === 'number'));
    return {
      path: entry.path, arm: `${index}:${arm}`, runs: group.length,
      simulatedLcpMs: pick(r => r.simulated.lcpMs), simulatedFcpMs: pick(r => r.simulated.fcpMs),
      tbtMs: pick(r => r.simulated.tbtMs), cls: pick(r => r.simulated.cls),
      observedLcpMs: pick(r => r.observed.lcpMs), ttfbMs: pick(r => r.observed.ttfbMs),
      transferBytes: pick(r => r.transferBytes.total), fontBytes: pick(r => r.transferBytes.font),
      requests: pick(r => r.requests),
    };
  }));
  writeFileSync(path.join(outDir, 'l3.json'), `${JSON.stringify({
    tool: 'scripts/perf/l3-lab.ts', measuredAt: new Date().toISOString(), base, runs, arms,
    profile: 'Lighthouse mobile, simulated throttling (Slow 4G, 4x CPU)', summary, results,
  }, null, 1)}\n`);
  console.log('| path | arm | n | LCP sim p50 (IQR) | FCP sim p50 | TBT p50 | CLS p50 | LCP observed p50 | transfer p50 | font bytes p50 | requests |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const s of summary) {
    console.log(`| ${s.path} | ${s.arm} | ${s.runs} | ${round(s.simulatedLcpMs.p50, 0)} (${round(s.simulatedLcpMs.iqr, 0)}) | ${round(s.simulatedFcpMs.p50, 0)} | ${round(s.tbtMs.p50, 0)} | ${round(s.cls.p50, 3)} | ${round(s.observedLcpMs.p50, 0)} | ${s.transferBytes.p50} | ${s.fontBytes.p50} | ${s.requests.p50} |`);
  }
}

if (import.meta.main) await main();
