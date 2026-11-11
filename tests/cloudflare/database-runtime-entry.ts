import { DurableObject } from 'cloudflare:workers';
import { createDurableDatabase, getDatabase, runWithDatabase } from '../../lib/cloudflare/database';
import { withDatabaseTransaction } from '../../lib/db-transaction';
import { applyMigrations, MegaSenaData, type DataEnvironment } from '../../cloudflare/data-object';
import seed from '../../db/seed/draws.json';
import { appendDraws, DrawSourceFailure, refreshDraws, type Draw } from '../../lib/draw-ingestion';
import { CaixaAPIClient } from '../../lib/api/caixa-client';
import { PairAnalysisEngine } from '../../lib/analytics/pair-analysis';
import { DecadeAnalysisEngine } from '../../lib/analytics/decade-analysis';
import { PrimeAnalysisEngine } from '../../lib/analytics/prime-analysis';
import { DelayAnalysisEngine } from '../../lib/analytics/delay-analysis';
import { StreakAnalysisEngine } from '../../lib/analytics/streak-analysis';
import { TimeSeriesEngine } from '../../lib/analytics/time-series';
import { PrizeCorrelationEngine } from '../../lib/analytics/prize-correlation';
import { DrawArchiveEngine } from '../../lib/analytics/draw-archive';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Contest 1 as a storage-ready draw.
const storedDraw: Draw = { contest: 1, date: '1996-03-11', numbers: [4, 5, 30, 33, 41, 52],
  prizeSena: 0, winnersSena: 0, prizeQuina: 0, winnersQuina: 0, prizeQuadra: 0, winnersQuadra: 0,
  totalCollection: 0, accumulated: false, accumulatedValue: 0, nextEstimatedPrize: 0, specialDraw: false };
const drawColumns = `contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6,
  prize_sena, winners_sena, prize_quina, winners_quina, prize_quadra, winners_quadra,
  total_collection, accumulated, accumulated_value, next_estimated_prize, special_draw`;
// A CAIXA payload with every stored field distinct, and the row it must produce.
const caixaPayload = { numero: 3, dataApuracao: '15/03/1996', listaDezenas: ['33', '01', '17', '60', '42', '08'],
  listaRateioPremio: [
    { descricaoFaixa: '6 acertos', faixa: 1, numeroDeGanhadores: 1, valorPremio: 1000000.5 },
    { descricaoFaixa: '5 acertos', faixa: 2, numeroDeGanhadores: 20, valorPremio: 30000.25 },
    { descricaoFaixa: '4 acertos', faixa: 3, numeroDeGanhadores: 400, valorPremio: 900.75 },
  ],
  valorArrecadado: 50000000, acumulado: true, valorAcumuladoProximoConcurso: 2000000,
  valorEstimadoProximoConcurso: 3000000, indicadorConcursoEspecial: 2 };
const caixaRow = { contest_number: 3, draw_date: '1996-03-15', number_1: 1, number_2: 8, number_3: 17, number_4: 33,
  number_5: 42, number_6: 60, prize_sena: 1000000.5, winners_sena: 1, prize_quina: 30000.25, winners_quina: 20,
  prize_quadra: 900.75, winners_quadra: 400, total_collection: 50000000, accumulated: 1, accumulated_value: 2000000,
  next_estimated_prize: 3000000, special_draw: 1 };

/** Refresh through the real CAIXA client with the network replaced by one fixed payload. */
async function refreshFromPayload(payload: unknown) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(payload);
  try { return await refreshDraws(new CaixaAPIClient({ timeoutMs: 10000, maxRetries: 1 }), { maxDraws: 1 }); }
  finally { globalThis.fetch = originalFetch; }
}

export class TestData extends DurableObject {
  async verify() {
    const db = createDurableDatabase(this.ctx.storage);
    return runWithDatabase(db, async () => {
      applyMigrations(db);
      applyMigrations(db);
      let failedMigration = false;
      try { applyMigrations(db, [['failure_control.sql', 'CREATE TABLE failure_control (id INTEGER); INSERT INTO nonexistent VALUES (1);']]); } catch { failedMigration = true; }
      assert(failedMigration && !db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'failure_control'").get(), 'migration SQL rollback');
      assert(!db.prepare("SELECT 1 FROM migrations WHERE name = 'failure_control.sql'").get(), 'migration marker rollback');
      assert((db.prepare('SELECT COUNT(*) AS count FROM migrations').get() as { count: number }).count === 10, 'migration ledger/idempotence');
      db.exec("INSERT INTO draws (contest_number,draw_date,number_1,number_2,number_3,number_4,number_5,number_6) VALUES (1,'1996-03-11',4,5,30,33,41,52)");
      const failures: string[] = [];
      for (const [name, check] of [
        ['pairs', () => new PairAnalysisEngine().updatePairFrequencies()],
        ['decades', () => assert(new DecadeAnalysisEngine().getDecadeDistribution().reduce((sum, item) => sum + item.totalOccurrences, 0) === 6, 'decade occurrences')],
        ['primes', () => assert(new PrimeAnalysisEngine().getPrimeDistribution().averagePrimesPerDraw === 2, 'prime occurrences')],
        ['delays', () => assert(new DelayAnalysisEngine().getNumberDelays().length === 60, 'number delays')],
        ['streaks', () => assert(new StreakAnalysisEngine().getHotStreaks().length === 60, 'streaks')],
        ['time-series', () => assert(new TimeSeriesEngine().getFrequencyTimeSeries([4])[0]?.['num_4'] === 1, 'time series')],
        ['prizes', () => assert(new PrizeCorrelationEngine().getPrizeCorrelation().length === 6, 'prize occurrences')],
        ['archive', () => { new DrawArchiveEngine().getNumbersIndex(); new DrawArchiveEngine().getNumberProfile(4); }],
      ] as const) {
        try { check(); } catch (error) { failures.push(`${name}: ${String(error)}`); }
      }
      assert(failures.length === 0, failures.join('; '));
      db.exec('DELETE FROM draws; DELETE FROM number_pair_frequency');
      let rolledBack = false;
      try {
        withDatabaseTransaction(db, () => {
          appendDraws([storedDraw]);
          throw new Error('outer rollback');
        });
      } catch { rolledBack = true; }
      assert(rolledBack, 'outer failure must surface');
      assert((db.prepare('SELECT COUNT(*) AS count FROM draws').get() as { count: number }).count === 0, 'nested draw rollback');
      assert((db.prepare('SELECT SUM(frequency) AS count FROM number_frequency').get() as { count: number }).count === 0, 'nested cache rollback');
      const first = appendDraws([storedDraw]);
      const repeat = appendDraws([storedDraw]);
      assert(first === 1 && repeat === 0, 'idempotent append and actual changes');
      assert((db.prepare('SELECT COUNT(*) AS count FROM number_pair_frequency').get() as { count: number }).count === 15, 'pair cache real SQL');
      let networkOutsideTransaction = false;
      let inTransaction = false;
      const originalTransaction = db.transactionSync!;
      db.transactionSync = fn => { inTransaction = true; try { return originalTransaction(fn); } finally { inTransaction = false; } };
      const result = await refreshDraws({
        fetchDraw: async contest => {
          assert(!inTransaction, 'network outside transaction');
          networkOutsideTransaction = true;
          return { ...storedDraw, contest: contest ?? 3 };
        },
      }, { maxDraws: 1 });
      assert(networkOutsideTransaction && result.status === 'incomplete' && result.lastContest === 2 && result.latestContest === 3, 'bounded backlog status');
      await refreshFromPayload(caixaPayload);
      const storedCaixa = db.prepare(`SELECT ${drawColumns} FROM draws WHERE contest_number = 3`).get();
      assert(JSON.stringify(storedCaixa) === JSON.stringify(caixaRow), `CAIXA payload stored values: ${JSON.stringify(storedCaixa)}`);
      let rejected = false;
      try {
        await refreshFromPayload({ numero: 4, dataApuracao: '18/03/1996', listaDezenas: ['1', '1', '2', '3', '4', '5'] });
      } catch (error) { rejected = error instanceof DrawSourceFailure; }
      assert(rejected && (db.prepare('SELECT MAX(contest_number) AS last FROM draws').get() as { last: number }).last === 3, 'invalid source control');
      rejected = false;
      try { appendDraws([{ ...storedDraw, numbers: [1, 2, 3, 4, 5, 6] }]); } catch { rejected = true; }
      assert(rejected, 'existing draw conflict');
      const before = (db.prepare('SELECT COUNT(*) AS count FROM draws').get() as { count: number }).count;
      rejected = false;
      try { await refreshDraws({ fetchDraw: async () => { throw new Error('CAIXA outage'); } }); } catch { rejected = true; }
      assert(rejected && (db.prepare('SELECT COUNT(*) AS count FROM draws').get() as { count: number }).count === before, 'outage preserves data');
      assert(getDatabase() === db, 'async database scope');
      return { migrations: 10, draws: before, nestedRollback: true, caches: true, invalidControl: true, conflictControl: true, outageControl: true, caixaStoredValues: true, boundedBacklog: true };
    });
  }
  count() {
    const db = createDurableDatabase(this.ctx.storage);
    applyMigrations(db);
    return (db.prepare('SELECT COUNT(*) AS count FROM draws').get() as { count: number }).count;
  }
}

export class TestSeededData extends MegaSenaData {
  /** First difference between the bootstrapped rows and the public seed, or null. */
  seedMismatch(): string | null {
    const rows = this.ctx.storage.sql.exec(`SELECT ${drawColumns} FROM draws ORDER BY contest_number`).toArray();
    if (rows.length !== seed.length) return `row count ${rows.length}`;
    for (const [index, row] of rows.entries()) {
      const stored = {
        contest: row['contest_number'], date: row['draw_date'],
        numbers: [row['number_1'], row['number_2'], row['number_3'], row['number_4'], row['number_5'], row['number_6']],
        prizeSena: row['prize_sena'], winnersSena: row['winners_sena'], prizeQuina: row['prize_quina'],
        winnersQuina: row['winners_quina'], prizeQuadra: row['prize_quadra'], winnersQuadra: row['winners_quadra'],
        totalCollection: row['total_collection'], accumulated: row['accumulated'] === 1,
        accumulatedValue: row['accumulated_value'], nextEstimatedPrize: row['next_estimated_prize'],
        specialDraw: row['special_draw'] === 1,
      };
      if (JSON.stringify(stored) !== JSON.stringify(seed[index])) return `contest ${String(row['contest_number'])}: ${JSON.stringify(row)}`;
    }
    return null;
  }
}

export class TestRetryData extends MegaSenaData {
  constructor(ctx: DurableObjectState, env: DataEnvironment) {
    super(ctx, { ...env, DAILY_REFRESH_ENABLED: '1' });
  }
  private makeDue(): void {
    this.ctx.storage.sql.exec('UPDATE ingestion_schedule SET next_due_at = ? WHERE id = 1', Date.now() - 1);
  }
  async refreshDue() { this.makeDue(); return this.refresh(); }
  async retryAlarm(): Promise<void> { this.makeDue(); await this.alarm(); }
  async failNextAlarmWrite(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    const setAlarm = this.ctx.storage.setAlarm.bind(this.ctx.storage);
    this.ctx.storage.setAlarm = async () => {
      this.ctx.storage.setAlarm = setAlarm;
      throw new Error('Injected alarm storage failure');
    };
  }
  alarmTime(): Promise<number | null> { return this.ctx.storage.getAlarm(); }
  insertExpiredEvents(): void {
    this.ctx.storage.sql.exec("INSERT INTO audit_logs (id,timestamp,event) VALUES ('expired-audit','2000-01-01T00:00:00.000Z','test'); INSERT INTO log_events (id,timestamp,level,event) VALUES ('expired-log','2000-01-01T00:00:00.000Z','info','test')");
  }
  insertRetainedEvents(): void {
    this.insertExpiredEvents();
    this.ctx.storage.sql.exec("INSERT INTO audit_logs (id,timestamp,event) VALUES ('retained-audit',datetime('now','-500 days'),'test'); INSERT INTO log_events (id,timestamp,level,event) VALUES ('retained-log',datetime('now','-60 days'),'info','test')");
  }
}

export class TestConfiguredRetention extends TestRetryData {
  constructor(ctx: DurableObjectState, env: DataEnvironment) {
    const configured = { ...env, AUDIT_RETENTION_DAYS: '730', LOG_RETENTION_DAYS: '90' };
    super(ctx, configured);
  }
}

export class TestDisabledRetention extends TestRetryData {
  constructor(ctx: DurableObjectState, env: DataEnvironment) {
    const configured = { ...env, AUDIT_RETENTION_DAYS: '0', LOG_RETENTION_DAYS: 'invalid' };
    super(ctx, configured);
  }
}

const worker = {
  async fetch(_request: Request, env: { DATA: DurableObjectNamespace<TestData>; SEEDED: DurableObjectNamespace<TestSeededData>; RETRY: DurableObjectNamespace<TestRetryData>; RETENTION: DurableObjectNamespace<TestConfiguredRetention>; DISABLED_RETENTION: DurableObjectNamespace<TestDisabledRetention> }) {
    try {
      const first = env.DATA.getByName('first');
      const second = env.DATA.getByName('second');
      const result = await first.verify();
      assert(await second.count() === 0, 'object isolation');
      const seeded = env.SEEDED.getByName('seed');
      const initial = await seeded.status();
      assert(initial.draws === seed.length, 'public seed bootstrap');
      assert(initial.numberOccurrences === seed.length * 6 && initial.cachedPairs === 1770, 'public seed caches rebuilt');
      const seedMismatch = await seeded.seedMismatch();
      assert(seedMismatch === null, `public seed readback: ${seedMismatch}`);
      assert(await seeded.importDraws(seed.slice(0, 10)) === 0, 'seed append duplicate');
      assert((await seeded.status()).draws === seed.length, 'seed not replaced');
      const health = await seeded.handle(new Request('https://example.com/api/health'), { internal: true, clientIp: null, secure: true });
      assert(health.status === 200, 'real API health request');
      const afterHealth = await seeded.status();
      assert(afterHealth.auditRows >= 1 && afterHealth.logRows >= 1, 'audit/log persisted before response');
      const retry = env.RETRY.getByName('retries');
      await retry.insertExpiredEvents();
      let rejected = false;
      try { await retry.refreshDue(); } catch { rejected = true; }
      assert(rejected, 'refresh outage must reject');
      assert((await retry.status()).ingestion?.['status'] === 'failed', 'persisted failure status');
      assert((await retry.status()).auditRows === 0 && (await retry.status()).logRows === 0, 'retention runs during CAIXA outages');
      assert((await retry.status()).ingestion?.['retry_count'] === 1 && await retry.alarmTime() !== null, 'first persisted alarm retry');
      for (let attempt = 0; attempt < 3; attempt++) await retry.retryAlarm();
      assert((await retry.status()).ingestion?.['retry_count'] === 3, 'bounded retry count');
      const afterExhaustion = await retry.alarmTime();
      assert(afterExhaustion !== null && afterExhaustion > Date.now(), 'enabled scheduler preserves its next daily alarm after retry budget exhaustion');
      const schedulingFailure = env.RETRY.getByName('scheduling-failure');
      try { await schedulingFailure.refreshDue(); } catch { /* Upstream outage schedules the first retry. */ }
      await schedulingFailure.failNextAlarmWrite();
      rejected = false;
      try { await schedulingFailure.retryAlarm(); } catch { rejected = true; }
      assert(rejected, 'alarm storage failure must escape for platform retry');
      assert((await schedulingFailure.status()).ingestion?.['retry_count'] === 1, 'failed alarm write must not consume retry budget');
      await schedulingFailure.retryAlarm();
      assert((await schedulingFailure.status()).ingestion?.['retry_count'] === 2 && await schedulingFailure.alarmTime() !== null, 'platform retry recovers alarm scheduling');
      const retention = env.RETENTION.getByName('configured');
      await retention.insertRetainedEvents();
      try { await retention.refreshDue(); } catch { /* Retention also runs during an upstream outage. */ }
      const retained = await retention.status();
      assert(retained.auditRows === 1 && retained.logRows === 1, 'configured retention preserves eligible history and deletes expired rows');
      const disabled = env.DISABLED_RETENTION.getByName('disabled');
      await disabled.insertRetainedEvents();
      try { await disabled.refreshDue(); } catch { /* Invalid/disabled settings must never trigger fallback deletion. */ }
      const unpruned = await disabled.status();
      assert(unpruned.auditRows === 2 && unpruned.logRows === 2, 'disabled or invalid retention preserves records like Bun');
      return Response.json({ pass: true, ...result, objectIsolation: true, publicSeedDraws: initial.draws,
        seedOccurrences: initial.numberOccurrences, seedReadback: true, seedPairs: initial.cachedPairs,
        auditRows: afterHealth.auditRows, logRows: afterHealth.logRows, boundedAlarmRetries: true, alarmStorageFailureRecovery: true, outageRetention: true, configuredRetention: true, disabledRetention: true, nativeBunTransactions: true });
    } catch (error) {
      return Response.json({ pass: false, error: String(error) }, { status: 500 });
    }
  },
};
export default worker;
export { MegaSenaData };
