import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import seed from '../../db/seed/draws.json';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
interface State {
  draws: number;
  ingestion: { status: string; retry_count: number } | null;
  schedule: { next_due_at: number; next_kind: string; revision: number } | null;
  alarm: number | null;
}
const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'megasena-scheduler-test-')));
const compiled = await build({
  entryPoints: ['tests/cloudflare/scheduler-entry.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers', 'node:*'],
  alias: { '@/lib/db': path.resolve('lib/cloudflare/database.ts') },
  plugins: [{ name: 'scheduler-runtime', setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)db(?:\.ts)?$/ }, args => {
      const resolved = args.path.startsWith('@/') ? path.resolve(args.path.slice(2)) : path.resolve(args.resolveDir, args.path);
      return resolved.replace(/\.ts$/, '') === path.resolve('lib/db') ? { path: path.resolve('lib/cloudflare/database.ts') } : undefined;
    });
    builder.onResolve({ filter: /\.sql\?raw$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.replace('?raw', '')), namespace: 'sql' }));
    builder.onLoad({ filter: /.*/, namespace: 'sql' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
  } }],
});
let sourceCalls = 0;
let failSource = false;
let networkGate: Promise<void> | undefined;
let reportNetworkStart: (() => void) | undefined;
const options = (dailyRefreshEnabled = '1') => ({ ...convertV4MiniflareOptions({ workers: [{
  name: 'scheduler-test', modules: true, script: compiled.outputFiles[0]!.text,
  compatibilityDate: '2026-10-02', compatibilityFlags: ['nodejs_compat'],
  bindings: { ENVIRONMENT: 'production', IP_HASH_SECRET: 'public-scheduler-test-only-secret-0123456789',
    BOOTSTRAP_PUBLIC_SEED: '1', DAILY_REFRESH_ENABLED: dailyRefreshEnabled },
  durableObjects: { DATA: { className: 'ScheduledData', useSQLite: true } },
  outboundService: async () => {
    sourceCalls++;
    reportNetworkStart?.();
    if (networkGate) await networkGate;
    return failSource ? new Response('Controlled CAIXA outage', { status: 400 }) : Response.json({
      numero: seed.length + 1, dataApuracao: '02/10/2026', listaDezenas: ['01', '02', '03', '04', '05', '06'],
    });
  },
}] }), resourcePersistencePath: path.join(directory, 'storage') });
let runtime = new Miniflare(options());
async function state(route = '/status'): Promise<State> {
  const response = await runtime.dispatchFetch('https://example.com' + route);
  const result = await response.json();
  assert(response.ok, `${route}: ${JSON.stringify(result)}`);
  return result as State;
}
function assertDaily(value: State, now = Date.now()) {
  const expected = new Date(now); expected.setUTCHours(6, 0, 0, 0);
  if (expected.getTime() <= now) expected.setUTCDate(expected.getUTCDate() + 1);
  assert(value.schedule?.next_kind === 'daily' && value.alarm === expected.getTime() && value.schedule.next_due_at === expected.getTime(), 'next calendar 06:00 UTC must remain armed');
}
async function assertHealthScheduler(enabled: boolean, nextAlarmAt: number | null, query = '') {
  const response = await runtime.dispatchFetch('https://example.com/api/health' + query);
  const body = await response.json() as { status: string; scheduler?: { enabled: boolean; nextAlarmAt: number | null } };
  assert(response.status === 200 && body.status === 'healthy', 'scheduler diagnostic must preserve healthy draw status');
  assert(response.headers.get('Cache-Control') === 'no-store', 'scheduler diagnostic must not be cached');
  assert(body.scheduler?.enabled === enabled && body.scheduler.nextAlarmAt === nextAlarmAt
    && Object.keys(body.scheduler).length === 2, 'health must expose exactly the enabled state and current native alarm');
}
try {
  const initial = await state();
  assert(initial.alarm !== null && initial.schedule !== null, 'first activation must persist and arm an autonomous refresh');
  // No HTTP/RPC traffic during this wait: workerd itself must deliver the alarm.
  await new Promise(resolve => setTimeout(resolve, 2500));
  const success = await state();
  assert(sourceCalls === 1 && success.draws === seed.length + 1 && success.ingestion?.status === 'success', 'real alarm must fetch and append without incoming traffic');
  assertDaily(success);
  await assertHealthScheduler(true, success.alarm);
  const healthFixture = await state('/due?object=health-diagnostic');
  assert(healthFixture.alarm !== null, 'diagnostic fixture must have a native alarm');
  await assertHealthScheduler(true, healthFixture.alarm, '?object=health-diagnostic');
  const withoutAlarm = await state('/clear-alarm?object=health-diagnostic');
  assert(withoutAlarm.alarm === null && withoutAlarm.schedule !== null, 'null-alarm control must retain a distinct schedule journal');
  await assertHealthScheduler(true, null, '?object=health-diagnostic');
  await runtime.dispatchFetch('https://example.com/fail-read?object=health-diagnostic');
  const readFailure = await runtime.dispatchFetch('https://example.com/api/health?object=health-diagnostic');
  const readFailureBody = await readFailure.json() as Record<string, unknown>;
  assert(readFailure.status === 503 && readFailure.headers.get('Cache-Control') === 'no-store', 'native alarm read failure must return a no-store 503 despite healthy data');
  assert(readFailureBody.status === 'unhealthy' && readFailureBody.error === 'Health check failed'
    && typeof readFailureBody.requestId === 'string' && typeof readFailureBody.timestamp === 'string'
    && Object.keys(readFailureBody).length === 4, 'native read failure must be sanitized and omit success-shaped data');
  await assertHealthScheduler(true, null, '?object=health-diagnostic');
  await state('/run');
  assert(sourceCalls === 1, 'early duplicate must not fetch or consume budget');

  failSource = true;
  await state('/due');
  let failed = await state('/run');
  assert(failed.ingestion?.status === 'failed' && failed.ingestion.retry_count === 1 && failed.schedule?.next_kind === 'retry', 'first failure keeps a persisted retry');
  const retryState = JSON.stringify(failed);
  await runtime.dispose();
  runtime = new Miniflare(options());
  assert(JSON.stringify(await state()) === retryState, 'runtime restart must preserve retry, budget, data and alarm');
  for (let retry = 0; retry < 3; retry++) { await state('/due'); failed = await state('/run'); }
  assert(failed.ingestion?.retry_count === 3 && failed.draws === seed.length + 1, 'bounded retries preserve data');
  assertDaily(failed);

  failSource = false;
  await state('/due');
  const beforeFailure = await state('/fail-write');
  const callsBefore = sourceCalls;
  assert((await runtime.dispatchFetch('https://example.com/run')).status === 500, 'alarm storage failure must escape');
  assert(sourceCalls === callsBefore && JSON.stringify(await state()) === JSON.stringify(beforeFailure), 'failed reservation must roll back before fetching or consuming retry budget');
  assertDaily(await state('/run'));
  assert((await state()).ingestion?.retry_count === 0, 'new daily cycle resets retry budget');

  await state('/due');
  await state('/fail-retention');
  const callsBeforeRetention = sourceCalls;
  assert((await runtime.dispatchFetch('https://example.com/run')).status === 500, 'SQLite retention failure must escape the alarm handler');
  const storageFailure = await state();
  assert(sourceCalls === callsBeforeRetention && storageFailure.ingestion?.status === 'failed'
    && storageFailure.schedule?.next_kind === 'retry' && storageFailure.alarm !== null,
  'storage failure remains observable and keeps its prearmed recovery');
  await state('/due');
  assertDaily(await state('/run'));

  await state('/due');
  let releaseNetwork!: () => void;
  networkGate = new Promise<void>(resolve => { releaseNetwork = resolve; });
  const networkStarted = new Promise<void>(resolve => { reportNetworkStart = resolve; });
  const interrupted = runtime.dispatchFetch('https://example.com/run').then(response => response.status, () => 599);
  await networkStarted;
  const inFlight = await state();
  assert(inFlight.ingestion?.status === 'running' && inFlight.schedule?.next_kind === 'retry'
    && inFlight.alarm === inFlight.schedule.next_due_at && inFlight.alarm! > Date.now(), 'successor must be durable before the network completes');
  await assertHealthScheduler(true, inFlight.alarm);
  // Health probes persist audit/log records; freeze the restart baseline afterward.
  const beforeInterruption = await state();
  const disposing = runtime.dispose();
  let restartDeadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([disposing, new Promise<never>((_resolve, reject) => {
      restartDeadline = setTimeout(() => reject(new Error('runtime did not stop during in-flight network')), 5000);
    })]);
  } finally {
    clearTimeout(restartDeadline);
    releaseNetwork(); networkGate = undefined; reportNetworkStart = undefined;
  }
  assert(await interrupted >= 500, 'runtime interruption must not report successful completion');
  runtime = new Miniflare(options());
  const afterInterruption = await state();
  assert(JSON.stringify(afterInterruption) === JSON.stringify(beforeInterruption), 'interruption must retain the prearmed successor and in-flight status');
  await state('/due');
  assertDaily(await state('/run'));

  for (const timestamp of ['2030-01-01T05:59:59Z', '2030-01-01T06:00:00Z', '2030-01-04T23:59:59Z']) {
    const now = Date.parse(timestamp);
    await state('/due?now=' + now);
    assertDaily(await state('/run?now=' + now), now);
  }
  await state('/due');
  const beforeDisable = await state();
  const callsBeforeDisable = sourceCalls;
  await runtime.dispose();
  runtime = new Miniflare(options('0'));
  const disabled = await state();
  assert(disabled.alarm === null, 'disabling daily refresh must cancel a pre-existing native alarm');
  assert(JSON.stringify(disabled) === JSON.stringify({ ...beforeDisable, alarm: null }), 'disabling preserves data, retry budget and schedule journal');
  await assertHealthScheduler(false, null);
  const disabledAfterProbe = await state();
  await state('/run');
  assert(sourceCalls === callsBeforeDisable && JSON.stringify(await state()) === JSON.stringify(disabledAfterProbe), 'stale disabled alarm must not fetch, write or rearm');
  const cold = await state('/status?object=cold-disabled');
  assert(cold.alarm === null && cold.schedule === null && cold.ingestion === null, 'disabled cold object must not initialize a schedule');
  assert(JSON.stringify(await state('/run?object=cold-disabled')) === JSON.stringify(cold) && sourceCalls === callsBeforeDisable, 'cold disabled alarm must be inert');
  await assertHealthScheduler(false, null, '?object=cold-disabled');
  const manual = await state('/refresh');
  assert(sourceCalls === callsBeforeDisable + 1 && manual.ingestion?.status === 'success' && manual.alarm === null, 'private manual refresh works without arming an alarm');
  failSource = true;
  assert((await runtime.dispatchFetch('https://example.com/refresh')).status === 500, 'manual refresh source failure stays observable');
  const manualFailure = await state();
  assert(manualFailure.ingestion?.status === 'failed' && manualFailure.ingestion.retry_count === 0 && manualFailure.alarm === null, 'disabled manual failure must not schedule an autonomous retry');
  const callsAfterManual = sourceCalls;
  await state('/run');
  assert(sourceCalls === callsAfterManual && JSON.stringify(await state()) === JSON.stringify(manualFailure), 'stale delivery after manual failure remains inert');
  const disabledWithAlarm = await state('/due?object=cold-disabled');
  assert(disabledWithAlarm.alarm !== null, 'disabled diagnostic control must contain a real native alarm');
  await assertHealthScheduler(false, disabledWithAlarm.alarm, '?object=cold-disabled');
  const evidence = { pass: true, autonomousAlarm: true, dailyAfterSuccess: true, dailyAfterExhaustion: true,
    restartPreservesRetry: true, interruptedNetworkRecovery: true, duplicateControl: true,
    storageFailureRollback: true, sqliteFailureEscapes: true, utcDayBoundaries: true,
    disabledCancelsAlarm: true, disabledAlarmInert: true, disabledManualRefresh: true,
    healthSchedulerNativeSnapshot: true, healthSchedulerReadFailure: true, sourceCalls };
  await mkdir('.scratch/cloudflare-database', { recursive: true });
  await writeFile('.scratch/cloudflare-database/scheduler-runtime-result.json', JSON.stringify(evidence));
  console.log(JSON.stringify(evidence));
} finally { await runtime.dispose(); }
