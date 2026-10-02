import { DurableObject } from 'cloudflare:workers';
import '../lib/log-context.runtime';
import { createDurableDatabase, runWithDatabase } from '@/lib/cloudflare/database';
import { withDatabaseTransaction, type DatabaseLike } from '@/lib/db-transaction';
import { createApiHandler, type ApiPeer } from '@/lib/api/handler';
import { createAuditWriter } from '@/lib/audit';
import { createLogWriter } from '@/lib/log-store';
import { runWithLogSink } from '@/lib/logger';
import { importSeedDraws, refreshDraws, type RefreshResult } from './ingestion';
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
}

export class MegaSenaData extends DurableObject<DataEnvironment> {
  private readonly database: DatabaseLike;
  private readonly handler: ReturnType<typeof createApiHandler>;
  private readonly audit = createAuditWriter({ automaticFlush: false });
  private refreshInFlight: Promise<RefreshResult> | undefined;

  constructor(ctx: DurableObjectState, env: DataEnvironment) {
    super(ctx, env);
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
    return this.refreshWithRetry(true);
  }

  private refreshWithRetry(resetRetries: boolean): Promise<RefreshResult> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = runWithDatabase(this.database, async () => {
      if (resetRetries) this.database.prepare('UPDATE ingestion_status SET retry_count = 0 WHERE id = 1').run();
      this.database.prepare(`INSERT INTO ingestion_status (id, status, attempted_at) VALUES (1, 'running', CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET status = 'running', attempted_at = CURRENT_TIMESTAMP, error_message = NULL`).run();
      try {
        this.pruneRetention();
        const result = await refreshDraws(this.database);
        this.database.prepare(`UPDATE ingestion_status SET status = ?, completed_at = CURRENT_TIMESTAMP,
          last_contest = ?, latest_contest = ?, error_message = NULL WHERE id = 1`).run(result.status, result.lastContest, result.latestContest);
        if (result.status === 'incomplete') await this.scheduleRetry();
        else await this.ctx.storage.deleteAlarm();
        return result;
      } catch (error) {
        this.database.prepare("UPDATE ingestion_status SET status = 'failed', error_message = ? WHERE id = 1").run(error instanceof Error ? error.message : String(error));
        await this.scheduleRetry();
        throw error;
      }
    }).finally(() => { this.refreshInFlight = undefined; });
    return this.refreshInFlight;
  }

  private async scheduleRetry(): Promise<void> {
    const row = this.database.prepare('SELECT retry_count FROM ingestion_status WHERE id = 1').get() as { retry_count: number };
    // Three persisted retries; the next daily Cron starts a new bounded cycle.
    if (row.retry_count >= 3) { await this.ctx.storage.deleteAlarm(); return; }
    this.database.prepare('UPDATE ingestion_status SET retry_count = retry_count + 1 WHERE id = 1').run();
    await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000 * 2 ** row.retry_count);
  }

  override async alarm(): Promise<void> {
    try { await this.refreshWithRetry(false); }
    catch (error) { console.error('ingestion.alarm_failed', error instanceof Error ? error.message : String(error)); }
  }

  private pruneRetention(): void {
    withDatabaseTransaction(this.database, () => {
      this.database.prepare("DELETE FROM audit_logs WHERE julianday(timestamp) < julianday('now', '-400 days')").run();
      this.database.prepare("DELETE FROM log_events WHERE julianday(timestamp) < julianday('now', '-30 days')").run();
      this.database.prepare('DELETE FROM rate_limit_windows WHERE reset_at <= ?').run(Date.now());
    });
  }
}
