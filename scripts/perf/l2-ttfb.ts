/**
 * L2 edge timing: user-perceived TTFB per URL from the machine running it.
 *
 *   bun run scripts/perf/l2-ttfb.ts --label baseline [--runs 30] [--base https://...]
 *     [--paths /,/concurso/3079] [--arms current,current] [--script megasena-analyser]
 *
 * Each URL is measured on new connections (one curl process per request, so DNS,
 * TCP and TLS are included) and on one reused connection (num_connects must be 0).
 * Arms are interleaved per request. `current,current` is the A/A noise run; a Worker
 * version id targets that version with Cloudflare-Workers-Version-Overrides.
 * Cache status is read only from cf-cache-status; X-Megasena-Cache is recorded
 * for diagnosis because the Worker writes it.
 *
 * The zone has a rate-limiting rule (observed: a 429 block after ~20 requests in a
 * few seconds). Requests are paced at --rate per minute (default 80) on both paths,
 * and any status other than the route's own (429, 403, 5xx...) aborts the run:
 * a block or error page is not a timing sample.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parsePositiveIntegerArg } from '../cli-args';
import {
  HARNESS_USER_AGENT, MAX_REQUESTS_PER_RUN, PAGE_MATRIX, assertExpectedStatus, resolveBaseUrl, stringArg,
} from './matrix';
import { round, summarize } from './stats';

const FIELDS = [
  'code', 'httpVersion', 'dnsS', 'connectS', 'tlsS', 'ttfbS', 'totalS', 'bytes', 'connects',
  'cfCacheStatus', 'workerCache', 'cfRay',
] as const;
const WRITE_OUT = '%{http_code}\t%{http_version}\t%{time_namelookup}\t%{time_connect}\t%{time_appconnect}\t'
  + '%{time_starttransfer}\t%{time_total}\t%{size_download}\t%{num_connects}\t%header{cf-cache-status}\t'
  + '%header{x-megasena-cache}\t%header{cf-ray}\n';

export interface Sample {
  path: string;
  arm: string;
  mode: 'new' | 'warm';
  code: number;
  httpVersion: string;
  dnsMs: number;
  connectMs: number;
  tlsMs: number;
  ttfbMs: number;
  totalMs: number;
  bytes: number;
  connects: number;
  cfCacheStatus: string;
  workerCache: string;
  colo: string;
}

export function parseWriteOut(line: string, context: Pick<Sample, 'path' | 'arm' | 'mode'>): Sample {
  const parts = line.split('\t');
  if (parts.length !== FIELDS.length) throw new Error(`Linha curl inesperada: ${JSON.stringify(line)}`);
  const ms = (value: string) => round(Number(value) * 1000, 2);
  return {
    ...context,
    code: Number(parts[0]),
    httpVersion: parts[1]!,
    dnsMs: ms(parts[2]!),
    connectMs: ms(parts[3]!),
    tlsMs: ms(parts[4]!),
    ttfbMs: ms(parts[5]!),
    totalMs: ms(parts[6]!),
    bytes: Number(parts[7]),
    connects: Number(parts[8]),
    cfCacheStatus: parts[9] || '-',
    workerCache: parts[10] || '-',
    colo: (parts[11] ?? '').split('-').pop() || '-',
  };
}

let sent = 0;
function reserve(count: number): void {
  sent += count;
  if (sent > MAX_REQUESTS_PER_RUN) throw new Error(`Limite de ${MAX_REQUESTS_PER_RUN} requisições por execução excedido.`);
}

let ratePerMinute = 80;
let lastRequestAt = 0;
async function pace(): Promise<void> {
  const wait = lastRequestAt + 60000 / ratePerMinute - Date.now();
  if (wait > 0) await Bun.sleep(wait);
  lastRequestAt = Date.now();
}

function curlArgs(url: string, arm: string, script: string, transfers: number): string[] {
  const args = ['-sS', '--http2', '--rate', `${ratePerMinute}/m`, '-A', HARNESS_USER_AGENT, '-H', 'Accept-Encoding: br, gzip',
    '-H', 'Accept: text/html,application/xhtml+xml,*/*;q=0.8'];
  if (arm !== 'current') args.push('-H', `Cloudflare-Workers-Version-Overrides: ${script}="${arm}"`);
  for (let index = 0; index < transfers; index++) args.push('-o', '/dev/null', '-w', WRITE_OUT, url);
  return args;
}

async function curl(args: string[]): Promise<string[]> {
  const proc = Bun.spawn(['curl', ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  if (code !== 0) throw new Error(`curl saiu com ${code}: ${err.trim()}`);
  return out.split('\n').filter(Boolean);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const base = resolveBaseUrl(args);
  const label = stringArg(args, '--label', 'adhoc');
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(label)) throw new Error('--label aceita apenas [a-z0-9._-].');
  const runs = parsePositiveIntegerArg(args, '--runs') ?? 30;
  ratePerMinute = parsePositiveIntegerArg(args, '--rate') ?? ratePerMinute;
  const arms = stringArg(args, '--arms', 'current,current').split(',');
  const script = stringArg(args, '--script', 'megasena-analyser');
  const only = args.includes('--paths') ? stringArg(args, '--paths', '').split(',') : null;
  const entries = PAGE_MATRIX.filter(entry => !only || only.includes(entry.path));
  if (entries.length === 0) throw new Error('Nenhuma URL selecionada.');
  const armIds = arms.map((arm, index) => `${index}:${arm}`);

  const samples: Sample[] = [];
  const startedAt = new Date().toISOString();
  for (const entry of entries) {
    const url = `${base}${entry.path}`;
    // New connections, interleaved A B A B.
    for (let run = 0; run < runs; run++) {
      for (const [index, arm] of arms.entries()) {
        reserve(1);
        await pace();
        const [line] = await curl(curlArgs(url, arm, script, 1));
        const sample = parseWriteOut(line!, { path: entry.path, arm: armIds[index]!, mode: 'new' });
        assertExpectedStatus(entry, sample.code);
        samples.push(sample);
      }
    }
    // Reused connection: one process per arm; the first transfer opens it and is discarded.
    const order = entries.indexOf(entry) % 2 === 0 ? [...arms.entries()] : [...arms.entries()].reverse();
    for (const [index, arm] of order) {
      reserve(runs + 1);
      await pace();
      const lines = await curl(curlArgs(url, arm, script, runs + 1));
      lastRequestAt = Date.now();
      for (const [position, line] of lines.entries()) {
        const sample = parseWriteOut(line, { path: entry.path, arm: armIds[index]!, mode: 'warm' });
        assertExpectedStatus(entry, sample.code);
        if (position === 0) continue;
        if (sample.connects !== 0) throw new Error(`Conexão não reutilizada em ${entry.path}`);
        samples.push(sample);
      }
    }
    process.stderr.write(`${entry.path} ok (${sent} requisições)\n`);
  }

  const summary = entries.flatMap(entry => armIds.flatMap(arm => (['new', 'warm'] as const).map((mode) => {
    const group = samples.filter(sample => sample.path === entry.path && sample.arm === arm && sample.mode === mode);
    const count = (key: 'cfCacheStatus' | 'workerCache' | 'httpVersion' | 'colo' | 'code') =>
      Object.fromEntries([...new Set(group.map(sample => String(sample[key])))]
        .map(value => [value, group.filter(sample => String(sample[key]) === value).length]));
    return {
      path: entry.path, routeClass: entry.routeClass, arm, mode,
      ttfbMs: summarize(group.map(sample => sample.ttfbMs)),
      totalMs: summarize(group.map(sample => sample.totalMs)),
      bytes: summarize(group.map(sample => sample.bytes)),
      cfCacheStatus: count('cfCacheStatus'), workerCache: count('workerCache'),
      httpVersion: count('httpVersion'), colo: count('colo'), code: count('code'),
    };
  })));

  const curlVersion = (await curl(['--version']))[0];
  const outDir = path.join('docs/perf/raw', label);
  mkdirSync(outDir, { recursive: true });
  const report = {
    tool: 'scripts/perf/l2-ttfb.ts', startedAt, finishedAt: new Date().toISOString(), base, runs, arms, ratePerMinute,
    requestsSent: sent, userAgent: HARNESS_USER_AGENT, curl: curlVersion, platform: `${process.platform} ${process.arch}`,
    bun: Bun.version, summary, samples,
  };
  writeFileSync(path.join(outDir, 'l2.json'), `${JSON.stringify(report, null, 1)}\n`);

  console.log(`| path | class | arm | conn | n | p50 | p95 | IQR | cf-cache-status | colo |`);
  console.log('|---|---|---|---|---:|---:|---:|---:|---|---|');
  for (const row of summary) {
    console.log(`| ${row.path} | ${row.routeClass} | ${row.arm} | ${row.mode} | ${row.ttfbMs.n} | ${row.ttfbMs.p50} | ${row.ttfbMs.p95} | ${round(row.ttfbMs.iqr)} | ${JSON.stringify(row.cfCacheStatus)} | ${Object.keys(row.colo).join(',')} |`);
  }
  console.log(`\n${sent} requisições; dados brutos em ${path.join(outDir, 'l2.json')}`);
}

if (import.meta.main) await main();
