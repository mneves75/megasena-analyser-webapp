import { describe, it, expect, vi } from 'vitest';

describe('audit', () => {
  it('flushes queued events into SQLite audit_logs (in-memory)', async () => {
    process.env.VITEST = '1';
    vi.resetModules();

    const { runMigrations, getDatabase } = await import('@/lib/db');
    const { enqueueAuditEvent, flushAuditQueue } = await import('@/lib/audit');

    runMigrations();

    enqueueAuditEvent({
      event: 'api.dashboard_read',
      requestId: 'req_test_1',
      route: '/api/dashboard',
      method: 'GET',
      statusCode: 200,
      success: true,
      durationMs: 42,
      clientIdHash: 'sha256:abc123',
      userAgent: 'UA\r\nInjected',
      metadata: {
        token: 'secret',
        ok: 'value',
      },
    });

    await flushAuditQueue('manual');

    const db = getDatabase();
    const rows = db
      .prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?')
      .all(1) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    const row = rows[0];

    expect(row.event).toBe('api.dashboard_read');
    expect(row.request_id).toBe('req_test_1');
    expect(row.route).toBe('/api/dashboard');
    expect(row.method).toBe('GET');
    expect(row.status_code).toBe(200);
    expect(row.success).toBe(1);
    expect(row.client_id_hash).toBe('sha256:abc123');
    expect(String(row.user_agent)).not.toContain('\n');

    const metadata = JSON.parse(String(row.metadata_json)) as Record<string, unknown>;
    expect(metadata.token).toBe('[REDACTED]');
    expect(metadata.ok).toBe('value');
  });

  it('retention hard-delete is idempotent (no rows left to delete)', async () => {
    process.env.VITEST = '1';
    vi.resetModules();

    const { runMigrations, getDatabase } = await import('@/lib/db');
    runMigrations();

    const db = getDatabase();

    db.prepare(
      `INSERT INTO audit_logs (
        id, timestamp, event, request_id, route, method, status_code, success,
        duration_ms, client_id_hash, user_agent, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'audit_1',
      '2000-01-01T00:00:00.000Z',
      'api.dashboard_read',
      'req_1',
      '/api/dashboard',
      'GET',
      200,
      1,
      10,
      'sha256:abc',
      'UA',
      JSON.stringify({ ok: true })
    );

    const cutoffIso = '2020-01-01T00:00:00.000Z';
    const first = db
      .prepare('DELETE FROM audit_logs WHERE timestamp < ?')
      .run(cutoffIso) as unknown as { changes?: number };
    expect(first.changes).toBe(1);

    const second = db
      .prepare('DELETE FROM audit_logs WHERE timestamp < ?')
      .run(cutoffIso) as unknown as { changes?: number };
    expect(second.changes).toBe(0);

    const rows = db
      .prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?')
      .all(1) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(0);
  });
});
