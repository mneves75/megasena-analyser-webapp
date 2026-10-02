import { DurableObject } from 'cloudflare:workers';
import { createDurableDatabase, getDatabase, runWithDatabase } from '../../lib/cloudflare/database';
import { withDatabaseTransaction } from '../../lib/db-transaction';
import { applyMigrations, MegaSenaData, type DataEnvironment } from '../../cloudflare/data-object';
import seed from '../../db/seed/draws.json';
import { appendDraws, refreshDraws } from '../../cloudflare/ingestion';
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

const draw = { numero: 1, dataApuracao: '11/03/1996', listaDezenas: ['04', '05', '30', '33', '41', '52'] };

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
          appendDraws(db, [draw]);
          throw new Error('outer rollback');
        });
      } catch { rolledBack = true; }
      assert(rolledBack, 'outer failure must surface');
      assert((db.prepare('SELECT COUNT(*) AS count FROM draws').get() as { count: number }).count === 0, 'nested draw rollback');
      assert((db.prepare('SELECT SUM(frequency) AS count FROM number_frequency').get() as { count: number }).count === 0, 'nested cache rollback');
      const first = appendDraws(db, [draw]);
      const repeat = appendDraws(db, [draw]);
      assert(first === 1 && repeat === 0, 'idempotent append and actual changes');
      assert((db.prepare('SELECT COUNT(*) AS count FROM number_pair_frequency').get() as { count: number }).count === 15, 'pair cache real SQL');
      let networkOutsideTransaction = false;
      let inTransaction = false;
      const originalTransaction = db.transactionSync!;
      db.transactionSync = fn => { inTransaction = true; try { return originalTransaction(fn); } finally { inTransaction = false; } };
      const result = await refreshDraws(db, {
        fetchDraw: async contest => {
          assert(!inTransaction, 'network outside transaction');
          networkOutsideTransaction = true;
          return { ...draw, numero: contest ?? 3 };
        },
      }, { maxDraws: 1 });
      assert(networkOutsideTransaction && result.status === 'incomplete' && result.lastContest === 2 && result.latestContest === 3, 'bounded backlog status');
      let rejected = false;
      try { appendDraws(db, [{ ...draw, numero: 3, listaDezenas: ['1', '1', '2', '3', '4', '5'] }]); } catch { rejected = true; }
      assert(rejected, 'invalid source control');
      rejected = false;
      try { appendDraws(db, [{ ...draw, listaDezenas: ['1', '2', '3', '4', '5', '6'] }]); } catch { rejected = true; }
      assert(rejected, 'existing draw conflict');
      const before = (db.prepare('SELECT COUNT(*) AS count FROM draws').get() as { count: number }).count;
      rejected = false;
      try { await refreshDraws(db, { fetchDraw: async () => { throw new Error('CAIXA outage'); } }); } catch { rejected = true; }
      assert(rejected && (db.prepare('SELECT COUNT(*) AS count FROM draws').get() as { count: number }).count === before, 'outage preserves data');
      assert(getDatabase() === db, 'async database scope');
      return { migrations: 10, draws: before, nestedRollback: true, caches: true, invalidControl: true, conflictControl: true, outageControl: true, boundedBacklog: true };
    });
  }
  count() {
    const db = createDurableDatabase(this.ctx.storage);
    applyMigrations(db);
    return (db.prepare('SELECT COUNT(*) AS count FROM draws').get() as { count: number }).count;
  }
}

export class TestRetryData extends MegaSenaData {
  async retryAlarm(): Promise<void> { await this.alarm(); }
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
  async fetch(_request: Request, env: { DATA: DurableObjectNamespace<TestData>; SEEDED: DurableObjectNamespace<MegaSenaData>; RETRY: DurableObjectNamespace<TestRetryData>; RETENTION: DurableObjectNamespace<TestConfiguredRetention>; DISABLED_RETENTION: DurableObjectNamespace<TestDisabledRetention> }) {
    try {
      const first = env.DATA.getByName('first');
      const second = env.DATA.getByName('second');
      const result = await first.verify();
      assert(await second.count() === 0, 'object isolation');
      const seeded = env.SEEDED.getByName('seed');
      const initial = await seeded.status();
      assert(initial.draws === seed.length, 'public seed bootstrap');
      assert(initial.numberOccurrences === seed.length * 6 && initial.cachedPairs === 1770, 'public seed caches rebuilt');
      assert(await seeded.importDraws(seed.slice(0, 10)) === 0, 'seed append duplicate');
      assert((await seeded.status()).draws === seed.length, 'seed not replaced');
      const health = await seeded.handle(new Request('https://example.com/api/health'), { internal: true, clientIp: null, secure: true });
      assert(health.status === 200, 'real API health request');
      const afterHealth = await seeded.status();
      assert(afterHealth.auditRows >= 1 && afterHealth.logRows >= 1, 'audit/log persisted before response');
      const retry = env.RETRY.getByName('retries');
      await retry.insertExpiredEvents();
      let rejected = false;
      try { await retry.refresh(); } catch { rejected = true; }
      assert(rejected, 'refresh outage must reject');
      assert((await retry.status()).ingestion?.['status'] === 'failed', 'persisted failure status');
      assert((await retry.status()).auditRows === 0 && (await retry.status()).logRows === 0, 'retention runs during CAIXA outages');
      assert((await retry.status()).ingestion?.['retry_count'] === 1 && await retry.alarmTime() !== null, 'first persisted alarm retry');
      for (let attempt = 0; attempt < 3; attempt++) await retry.retryAlarm();
      assert((await retry.status()).ingestion?.['retry_count'] === 3, 'bounded retry count');
      assert(await retry.alarmTime() === null, 'no alarm after retry budget exhaustion');
      const schedulingFailure = env.RETRY.getByName('scheduling-failure');
      try { await schedulingFailure.refresh(); } catch { /* Upstream outage schedules the first retry. */ }
      await schedulingFailure.failNextAlarmWrite();
      rejected = false;
      try { await schedulingFailure.retryAlarm(); } catch { rejected = true; }
      assert(rejected, 'alarm storage failure must escape for platform retry');
      assert((await schedulingFailure.status()).ingestion?.['retry_count'] === 1, 'failed alarm write must not consume retry budget');
      await schedulingFailure.retryAlarm();
      assert((await schedulingFailure.status()).ingestion?.['retry_count'] === 2 && await schedulingFailure.alarmTime() !== null, 'platform retry recovers alarm scheduling');
      const retention = env.RETENTION.getByName('configured');
      await retention.insertRetainedEvents();
      try { await retention.refresh(); } catch { /* Retention also runs during an upstream outage. */ }
      const retained = await retention.status();
      assert(retained.auditRows === 1 && retained.logRows === 1, 'configured retention preserves eligible history and deletes expired rows');
      const disabled = env.DISABLED_RETENTION.getByName('disabled');
      await disabled.insertRetainedEvents();
      try { await disabled.refresh(); } catch { /* Invalid/disabled settings must never trigger fallback deletion. */ }
      const unpruned = await disabled.status();
      assert(unpruned.auditRows === 2 && unpruned.logRows === 2, 'disabled or invalid retention preserves records like Bun');
      return Response.json({ pass: true, ...result, objectIsolation: true, publicSeedDraws: initial.draws,
        seedOccurrences: initial.numberOccurrences, seedPairs: initial.cachedPairs,
        auditRows: afterHealth.auditRows, logRows: afterHealth.logRows, boundedAlarmRetries: true, alarmStorageFailureRecovery: true, outageRetention: true, configuredRetention: true, disabledRetention: true, nativeBunTransactions: true });
    } catch (error) {
      return Response.json({ pass: false, error: String(error) }, { status: 500 });
    }
  },
};
export default worker;
export { MegaSenaData };
