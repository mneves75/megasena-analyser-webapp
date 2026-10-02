import { MegaSenaData, type DataEnvironment } from '../../cloudflare/data-object';

export class ScheduledData extends MegaSenaData {
  constructor(ctx: DurableObjectState, env: DataEnvironment) {
    super(ctx, { ...env, DAILY_REFRESH_ENABLED: '1' });
  }

  async inspect() {
    const exists = this.ctx.storage.sql.exec("SELECT 1 FROM sqlite_master WHERE name = 'ingestion_schedule'").toArray().length;
    const schedule = exists ? this.ctx.storage.sql.exec('SELECT * FROM ingestion_schedule WHERE id = 1').toArray()[0] : null;
    return { ...this.status(), schedule, alarm: await this.ctx.storage.getAlarm() };
  }

  async makeDue(now = Date.now()) {
    this.ctx.storage.sql.exec('UPDATE ingestion_schedule SET next_due_at = ? WHERE id = 1', now - 1);
    // Keep the real timer out of the way while the test invokes the due handler.
    await this.ctx.storage.setAlarm(Date.now() + 60_000);
  }

  async run(now?: number) {
    const originalNow = Date.now;
    if (now !== undefined) Date.now = () => now;
    try { await this.alarm(); }
    finally { Date.now = originalNow; }
  }

  failNextAlarmWrite() {
    const original = this.ctx.storage.setAlarm.bind(this.ctx.storage);
    this.ctx.storage.setAlarm = async () => {
      this.ctx.storage.setAlarm = original;
      throw new Error('Injected scheduler storage failure');
    };
  }

  failNextRetentionWrite() {
    const original = this.ctx.storage.sql.exec.bind(this.ctx.storage.sql);
    this.ctx.storage.sql.exec = ((query: string, ...bindings: SqlStorageValue[]) => {
      if (query.startsWith('DELETE FROM audit_logs')) {
        this.ctx.storage.sql.exec = original;
        throw new Error('Injected retention SQLite failure');
      }
      return original(query, ...bindings);
    }) as typeof this.ctx.storage.sql.exec;
  }
}

const worker = {
  async fetch(request: Request, env: { DATA: DurableObjectNamespace<ScheduledData> }) {
    const object = env.DATA.getByName('scheduler-fixture');
    const url = new URL(request.url);
    const now = url.searchParams.has('now') ? Number(url.searchParams.get('now')) : undefined;
    try {
      if (url.pathname === '/due') await object.makeDue(now);
      if (url.pathname === '/run') await object.run(now);
      if (url.pathname === '/fail-write') await object.failNextAlarmWrite();
      if (url.pathname === '/fail-retention') await object.failNextRetentionWrite();
      return Response.json(await object.inspect());
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 500 });
    }
  },
};
export default worker;
