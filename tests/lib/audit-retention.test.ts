import { describe, expect, it, vi } from 'vitest';

describe('audit retention', () => {
  it('hard-deletes audit logs older than cutoff', async () => {
    process.env.VITEST = '1';
    vi.resetModules();

    const { runMigrations, getDatabase, closeDatabase } = await import('@/lib/db');
    const { runAuditRetention } = await import('@/lib/audit-retention');

    closeDatabase();
    runMigrations();
    const db = getDatabase();

    db.prepare(
      `INSERT INTO audit_logs (
        id, timestamp, event, request_id, route, method, status_code, success,
        duration_ms, client_id_hash, user_agent, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'audit_old',
      '2000-01-01T00:00:00.000Z',
      'api.dashboard_read',
      'req_old',
      '/api/dashboard',
      'GET',
      200,
      1,
      10,
      'sha256:old',
      'UA',
      JSON.stringify({ ok: true })
    );

    db.prepare(
      `INSERT INTO audit_logs (
        id, timestamp, event, request_id, route, method, status_code, success,
        duration_ms, client_id_hash, user_agent, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'audit_new',
      new Date().toISOString(),
      'api.dashboard_read',
      'req_new',
      '/api/dashboard',
      'GET',
      200,
      1,
      10,
      'sha256:new',
      'UA',
      JSON.stringify({ ok: true })
    );

    const result = await runAuditRetention({ retentionDays: 1, reason: 'test' });
    expect(result.eligibleCount).toBeGreaterThanOrEqual(1);
    expect(result.deletedCount).toBeGreaterThanOrEqual(1);
  });

  it('reports eligible rows without mutating on dry run', async () => {
    process.env.VITEST = '1';
    vi.resetModules();

    const { runMigrations, getDatabase, closeDatabase } = await import('@/lib/db');
    const { runAuditRetention } = await import('@/lib/audit-retention');

    closeDatabase();
    runMigrations();
    const db = getDatabase();

    db.prepare(
      `INSERT INTO audit_logs (
        id, timestamp, event, request_id, route, method, status_code, success,
        duration_ms, client_id_hash, user_agent, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'audit_dry',
      '2000-01-01T00:00:00.000Z',
      'api.dashboard_read',
      'req_dry',
      '/api/dashboard',
      'GET',
      200,
      1,
      10,
      'sha256:dry',
      'UA',
      JSON.stringify({ ok: true })
    );

    const result = await runAuditRetention({ retentionDays: 1, dryRun: true, reason: 'test' });
    expect(result.eligibleCount).toBeGreaterThanOrEqual(1);
    expect(result.dryRun).toBe(true);
  });
});
