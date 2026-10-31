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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parsePositiveIntegerArg } from '../cli-args';
import { HARNESS_USER_AGENT, type AssetStatus, PAGE_MATRIX, RUM_BLOCK_PATTERNS, assertExpectedStatus, assertRequiredAssetsLoaded, resolveBaseUrl, stringArg } from './matrix';
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
  for (let attempt = 1; ; attempt++) {
    // A report left by an earlier attempt must never be read as this attempt's.
    rmSync(outFile, { force: true });
    const proc = Bun.spawn(['lighthouse', ...args], { stdout: 'pipe', stderr: 'pipe' });
    const [err, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    if (code === 0) return;
    const report = existsSync(outFile) ? readFileSync(outFile, 'utf8') : null;
    const failure = `lighthouse saiu com ${code}: ${err.trim().slice(-500)}`;
    if (lighthouseFailure(err, report) === 'fail') throw new Error(`${failure}; execução inválida.`);
    if (attempt >= LIGHTHOUSE_ATTEMPTS) throw new Error(failure);
    process.stderr.write(`lighthouse falhou (tentativa ${attempt}/${LIGHTHOUSE_ATTEMPTS}), repetindo: ${err.trim().slice(-160)}\n`);
    await Bun.sleep(5000);
  }
}

const LIGHTHOUSE_ATTEMPTS = 3;
/** Runtime errors of the tool itself, not of the page; they produced no sample. */
const RETRYABLE_LIGHTHOUSE_ERRORS = ['NO_NAVSTART', 'PROTOCOL_TIMEOUT'];

/**
 * Lighthouse exits non-zero both for its own failures and for page failures
 * (an error status such as 429 sets runtimeError ERRORED_DOCUMENT_REQUEST). Only
 * an identified tool failure may be retried: retrying a page failure until a
 * later attempt succeeds would hide it.
 */
export function lighthouseFailure(stderr: string, report: string | null): 'retry' | 'fail' {
  if (report !== null) {
    let code: unknown;
    try {
      code = JSON.parse(report)?.runtimeError?.code;
    } catch {
      return 'fail';
    }
    return typeof code === 'string' && RETRYABLE_LIGHTHOUSE_ERRORS.includes(code) ? 'retry' : 'fail';
  }
  return RETRYABLE_LIGHTHOUSE_ERRORS.some(code => stderr.includes(code)) ? 'retry' : 'fail';
}

/** Same-origin requests become `pathname + search`; others are recorded by host. */
export function networkPath(url: string, base: string): string {
  const parsed = new URL(url);
  return parsed.origin === new URL(base).origin ? parsed.pathname + parsed.search : parsed.host;
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
    runtimeError: lhr.runtimeError?.code as string | undefined,
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
    fontRequests: requests.filter(r => r.resourceType === 'Font').map(r => networkPath(r.url, base)),
    network: requests.map(r => ({ path: networkPath(r.url, base),
      type: r.resourceType, status: r.statusCode, transferSize: r.transferSize, resourceSize: r.resourceSize })),
  };
}

/**
 * Same-origin entries of the extracted network log (paths start with `/`;
 * third parties are recorded by host). The RUM beacon is blocked on purpose in
 * the lab and reports -1, so it must not invalidate the sample.
 */
export function labAssets(network: { path: string; type?: string | undefined; status?: number | undefined }[]): AssetStatus[] {
  return network.filter(r => r.path.startsWith('/')).map(r => ({ path: r.path, type: r.type, status: r.status }));
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
        if (result.runtimeError) throw new Error(`Lighthouse ${result.runtimeError} em ${entry.path}: execução inválida.`);
        if (result.rateLimited > 0) throw new Error(`429 em ${entry.path}: execução inválida; aumente --gap-ms.`);
        assertExpectedStatus(entry, result.documentStatus);
        assertRequiredAssetsLoaded(entry.path, labAssets(result.network));
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
