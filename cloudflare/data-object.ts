import { DurableObject } from 'cloudflare:workers';
import '../lib/log-context.runtime';
import { createDurableDatabase, runWithDatabase } from '@/lib/cloudflare/database';
import { withDatabaseTransaction, type DatabaseLike } from '@/lib/db-transaction';
import { createApiHandler, type ApiPeer } from '@/lib/api/handler';
import { createAuditWriter } from '@/lib/audit';
import { createLogWriter } from '@/lib/log-store';
import { runWithLogSink } from '@/lib/logger';
import { DrawSourceFailure, importSeedDraws, refreshDraws, type RefreshResult } from './ingestion';
import publicSeed from '../db/seed/draws.json';
import migration001 from '../db/migrations/001_initial_schema.sql?raw';
import migration002 from '../db/migrations/002_add_performance_indexes.sql?raw';
import migration003 from '../db/migrations/003_pair_frequency_cache.sql?raw';
import migration004 from '../db/migrations/004_audit_logs.sql?raw';
import migration005 from '../db/migrations/005_log_events.sql?raw';
import migration006 from '../db/migrations/006_remove_deleted_at.sql?raw';
import migration007 from '../db/migrations/007_draw_number_integrity.sql?raw';
import migration008 from '../db/migrations/008_draw_date_iso.sql?raw';
import migration009 from '../db/migrations/009_number_frequency_date_iso.sql?raw';
import migration010 from '../db/migrations/010_draws_cache_revision.sql?raw';

const migrations = [
  ['001_initial_schema.sql', migration001], ['002_add_performance_indexes.sql', migration002],
  ['003_pair_frequency_cache.sql', migration003], ['004_audit_logs.sql', migration004],
  ['005_log_events.sql', migration005], ['006_remove_deleted_at.sql', migration006],
  ['007_draw_number_integrity.sql', migration007], ['008_draw_date_iso.sql', migration008],
  ['009_number_frequency_date_iso.sql', migration009], ['010_draws_cache_revision.sql', migration010],
] as const;

export function applyMigrations(database: DatabaseLike, entries: readonly (readonly [string, string])[] = migrations): void {
  database.exec(`CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'success', error_message TEXT
  )`);
  for (const [name, sql] of entries) {
    if (database.prepare("SELECT 1 FROM migrations WHERE name = ? AND status = 'success'").get(name)) continue;
    withDatabaseTransaction(database, () => {
      database.exec(sql);
      database.prepare("INSERT INTO migrations (name, status) VALUES (?, 'success')").run(name);
    });
  }
}

export interface DataEnvironment {
  IP_HASH_SECRET?: string;
  APP_VERSION?: string;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  BOOTSTRAP_PUBLIC_SEED?: string;
  AUDIT_RETENTION_DAYS?: string;
  LOG_RETENTION_DAYS?: string;
  DAILY_REFRESH_ENABLED?: string;
}

interface RefreshSchedule {
  next_due_at: number;
  next_kind: 'daily' | 'retry';
  revision: number;
}

function nextDailyRefresh(now: number): number {
  const next = new Date(now);
  next.setUTCHours(6, 0, 0, 0);
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}

class RefreshFailure extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

export class MegaSenaData extends DurableObject<DataEnvironment> {
  private readonly database: DatabaseLike;
  private readonly handler: ReturnType<typeof createApiHandler>;
  private readonly audit = createAuditWriter({ automaticFlush: false });
  private readonly auditRetentionDays: number;
  private readonly logRetentionDays: number;
  private readonly dailyRefreshEnabled: boolean;
  private refreshInFlight: Promise<RefreshResult> | undefined;

  constructor(ctx: DurableObjectState, env: DataEnvironment) {
    super(ctx, env);
    this.auditRetentionDays = Number(env.AUDIT_RETENTION_DAYS ?? '400');
    this.logRetentionDays = Number(env.LOG_RETENTION_DAYS ?? '30');
    this.dailyRefreshEnabled = env.DAILY_REFRESH_ENABLED === '1';
    if ((env.ENVIRONMENT ?? 'production') === 'production' && (env.IP_HASH_SECRET?.trim().length ?? 0) < 32) {
      throw new Error('IP_HASH_SECRET required in production (at least 32 characters)');
    }
    this.database = createDurableDatabase(ctx.storage);
    applyMigrations(this.database);
    this.database.exec(`CREATE TABLE IF NOT EXISTS rate_limit_windows (
      client_id TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL
    ); CREATE TABLE IF NOT EXISTS ingestion_status (
      id INTEGER PRIMARY KEY CHECK(id = 1), status TEXT NOT NULL, attempted_at TEXT NOT NULL,
      completed_at TEXT, last_contest INTEGER, latest_contest INTEGER, error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0
    ); CREATE TABLE IF NOT EXISTS ingestion_schedule (
      id INTEGER PRIMARY KEY CHECK(id = 1), next_due_at INTEGER NOT NULL,
      next_kind TEXT NOT NULL CHECK(next_kind IN ('daily', 'retry')),
      revision INTEGER NOT NULL
    )`);
    const stored = this.database.prepare('SELECT COUNT(*) AS count FROM draws').get() as { count: number };
    if (env.BOOTSTRAP_PUBLIC_SEED === '1' && stored.count === 0) {
      importSeedDraws(this.database, publicSeed);
    }
    this.handler = createApiHandler({
      environment: env.ENVIRONMENT ?? 'production', appVersion: env.APP_VERSION ?? 'unknown',
      ipHashSecret: env.IP_HASH_SECRET, allowedOrigins: env.ALLOWED_ORIGINS,
      audit: async event => { this.audit.enqueue(event); await this.audit.stop(); },
      checkRateLimit: clientId => this.checkRateLimit(clientId),
    });
    if (this.dailyRefreshEnabled) {
      void ctx.blockConcurrencyWhile(() => this.initializeSchedule());
    }
  }

  private schedule(): RefreshSchedule | undefined {
    return this.database.prepare('SELECT next_due_at, next_kind, revision FROM ingestion_schedule WHERE id = 1').get() as RefreshSchedule | undefined;
  }

  private async initializeSchedule(): Promise<void> {
    await this.ctx.storage.transaction(async () => {
      const alarm = await this.ctx.storage.getAlarm();
      const schedule = this.schedule();
      if (schedule) {
        if (alarm === null) await this.ctx.storage.setAlarm(schedule.next_due_at);
        return;
      }
      // Adopt an older retry alarm; deployment must not reset its budget.
      await this.writeSchedule(alarm ?? Date.now() + 1000, alarm === null ? 'daily' : 'retry');
    });
  }

  /** Caller holds the storage transaction: journal and native alarm commit together. */
  private async writeSchedule(due: number, kind: RefreshSchedule['next_kind']): Promise<number> {
    this.database.prepare(`INSERT INTO ingestion_schedule (id, next_due_at, next_kind, revision) VALUES (1, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET next_due_at = excluded.next_due_at,
      next_kind = excluded.next_kind, revision = revision + 1`).run(due, kind);
    await this.ctx.storage.setAlarm(due);
    return this.schedule()!.revision;
  }

  private checkRateLimit(clientId: string) {
    const now = Date.now();
    return withDatabaseTransaction(this.database, () => {
      this.database.prepare('DELETE FROM rate_limit_windows WHERE reset_at <= ?').run(now);
      this.database.prepare(`INSERT INTO rate_limit_windows (client_id, count, reset_at) VALUES (?, 1, ?)
        ON CONFLICT(client_id) DO UPDATE SET count = count + 1`).run(clientId, now + 60000);
      const row = this.database.prepare('SELECT count, reset_at FROM rate_limit_windows WHERE client_id = ?').get(clientId) as { count: number; reset_at: number };
      return { allowed: row.count <= 100, remaining: Math.max(0, 100 - row.count), resetAt: row.reset_at };
    });
  }

  /** Reachable only by a bound Worker stub; public fetch does not route to this class. */
  async handle(request: Request, peer: ApiPeer): Promise<Response> {
    const logs = createLogWriter({ automaticFlush: false });
    return runWithDatabase(this.database, () => runWithLogSink(logs.enqueue, async () => {
      try { return await this.handler.fetch(request, peer); }
      finally { await logs.stop(); }
    }));
  }

  importDraws(input: unknown): number {
    return runWithDatabase(this.database, () => importSeedDraws(this.database, input));
  }

  status() {
    const summary = this.database.prepare('SELECT COUNT(*) AS count, MAX(contest_number) AS last FROM draws').get() as { count: number; last: number | null };
    const audit = this.database.prepare('SELECT COUNT(*) AS count FROM audit_logs').get() as { count: number };
    const logs = this.database.prepare('SELECT COUNT(*) AS count FROM log_events').get() as { count: number };
    const frequency = this.database.prepare('SELECT SUM(frequency) AS count FROM number_frequency').get() as { count: number };
    const pairs = this.database.prepare('SELECT COUNT(*) AS count FROM number_pair_frequency').get() as { count: number };
    const ingestion = this.database.prepare('SELECT * FROM ingestion_status WHERE id = 1').get() as Record<string, unknown> | undefined;
    return { draws: summary.count, lastContest: summary.last, auditRows: audit.count, logRows: logs.count,
      numberOccurrences: frequency.count, cachedPairs: pairs.count, ingestion: ingestion ?? null };
  }

  refresh(): Promise<RefreshResult> {
    if (this.refreshInFlight) return this.refreshInFlight;
    if (this.dailyRefreshEnabled) {
      const schedule = this.schedule();
      if (!schedule || schedule.next_due_at > Date.now()) return Promise.reject(new Error('CAIXA refresh is not due.'));
      return this.refreshWithRetry(schedule.next_kind === 'daily');
    }
    return this.refreshWithRetry(true);
  }

  private refreshWithRetry(resetRetries: boolean): Promise<RefreshResult> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = runWithDatabase(this.database, async () => {
      const reservation = await this.ctx.storage.transaction(async () => {
        if (resetRetries) this.database.prepare('UPDATE ingestion_status SET retry_count = 0 WHERE id = 1').run();
        this.database.prepare(`INSERT INTO ingestion_status (id, status, attempted_at) VALUES (1, 'running', CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET status = 'running', attempted_at = CURRENT_TIMESTAMP, error_message = NULL`).run();
        // Persist the next wake-up before network I/O, including the final daily successor.
        await this.reserveSuccessor();
        return this.schedule()?.revision;
      });
      let result: RefreshResult;
      try {
        this.pruneRetention();
        result = await refreshDraws(this.database);
      } catch (error) {
        if (this.schedule()?.revision === reservation) {
          this.database.prepare("UPDATE ingestion_status SET status = 'failed', error_message = ? WHERE id = 1").run(error instanceof Error ? error.message : String(error));
        }
        if (!(error instanceof DrawSourceFailure)) throw error;
        // The successor was already persisted; only expected upstream failures are caught by alarm().
        throw new RefreshFailure(error);
      }
      await this.ctx.storage.transaction(async () => {
        if (this.schedule()?.revision !== reservation) return;
        this.database.prepare(`UPDATE ingestion_status SET status = ?, completed_at = CURRENT_TIMESTAMP,
          last_contest = ?, latest_contest = ?, error_message = NULL WHERE id = 1`).run(result.status, result.lastContest, result.latestContest);
        if (result.status === 'success') {
          this.database.prepare('UPDATE ingestion_status SET retry_count = 0 WHERE id = 1').run();
          if (this.dailyRefreshEnabled) await this.writeSchedule(nextDailyRefresh(Date.now()), 'daily');
          else await this.ctx.storage.deleteAlarm();
        }
      });
      return result;
    }).finally(() => { this.refreshInFlight = undefined; });
    return this.refreshInFlight;
  }

  private async reserveSuccessor(): Promise<void> {
    const row = this.database.prepare('SELECT retry_count FROM ingestion_status WHERE id = 1').get() as { retry_count: number };
    if (row.retry_count >= 3) {
      if (this.dailyRefreshEnabled) await this.writeSchedule(nextDailyRefresh(Date.now()), 'daily');
      else await this.ctx.storage.deleteAlarm();
      return;
    }
    this.database.prepare('UPDATE ingestion_status SET retry_count = retry_count + 1 WHERE id = 1').run();
    const due = Date.now() + 5 * 60 * 1000 * 2 ** row.retry_count;
    if (this.dailyRefreshEnabled) await this.writeSchedule(due, 'retry');
    else await this.ctx.storage.setAlarm(due);
  }

  override async alarm(): Promise<void> {
    if (this.dailyRefreshEnabled) {
      const schedule = this.schedule();
      if (schedule && schedule.next_due_at > Date.now()) {
        await this.ctx.storage.setAlarm(schedule.next_due_at);
        return;
      }
    }
    try {
      const result = await (this.dailyRefreshEnabled ? this.refresh() : this.refreshWithRetry(false));
      console.info('caixa.daily_refresh', result);
    }
    catch (error) {
      if (!(error instanceof RefreshFailure)) throw error;
      console.error('ingestion.alarm_failed', error.message);
    }
  }

  private pruneRetention(): void {
    withDatabaseTransaction(this.database, () => {
      // Match Bun: invalid or nonpositive settings disable deletion, never shorten retention.
      if (Number.isFinite(this.auditRetentionDays) && this.auditRetentionDays > 0) {
        this.database.prepare("DELETE FROM audit_logs WHERE julianday(timestamp) < julianday('now', ?)").run(`-${this.auditRetentionDays} days`);
      }
      if (Number.isFinite(this.logRetentionDays) && this.logRetentionDays > 0) {
        this.database.prepare("DELETE FROM log_events WHERE julianday(timestamp) < julianday('now', ?)").run(`-${this.logRetentionDays} days`);
      }
      this.database.prepare('DELETE FROM rate_limit_windows WHERE reset_at <= ?').run(Date.now());
    });
  }
}
