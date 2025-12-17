#!/usr/bin/env bun

import { getDatabase, closeDatabase } from '@/lib/db';
import { logger } from '@/lib/logger';

type ParsedArgs = {
  days?: number;
  before?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token === '--days') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --days');
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error('--days must be a positive number');
      }
      args.days = Math.floor(parsed);
      i++;
      continue;
    }

    if (token === '--before') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --before');
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('--before must be a valid date (e.g. 2025-12-17T00:00:00.000Z)');
      }
      args.before = parsed.toISOString();
      i++;
      continue;
    }

    if (token === '--help' || token === '-h') {
      throw new Error(
        'Usage: bun run scripts/prune-audit-logs.ts [--days N | --before ISO_DATE] [--dry-run]\n' +
          'Examples:\n' +
          '  bun run scripts/prune-audit-logs.ts --days 365\n' +
          '  bun run scripts/prune-audit-logs.ts --before 2025-01-01T00:00:00.000Z --dry-run'
      );
    }
  }

  return args;
}

function isoCutoffFromDays(days: number): string {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(cutoffMs).toISOString();
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const retentionDays = typeof parsed.days === 'number' ? parsed.days : 365;
  const cutoffIso = parsed.before ?? isoCutoffFromDays(retentionDays);
  const nowIso = new Date().toISOString();

  logger.info('audit.retention_started', {
    cutoff: cutoffIso,
    retentionDays: parsed.before ? undefined : retentionDays,
    dryRun: parsed.dryRun,
  });

  const db = getDatabase();

  try {
    const toDelete = db
      .prepare('SELECT COUNT(*) as count FROM audit_logs WHERE deleted_at IS NULL AND timestamp < ?')
      .get(cutoffIso) as { count: number };

    if (parsed.dryRun) {
      logger.info('audit.retention_dry_run', {
        cutoff: cutoffIso,
        eligibleCount: toDelete.count,
      });
      return;
    }

    const result = db
      .prepare('UPDATE audit_logs SET deleted_at = ? WHERE deleted_at IS NULL AND timestamp < ?')
      .run(nowIso, cutoffIso) as unknown as { changes?: number };

    logger.info('audit.retention_applied', {
      cutoff: cutoffIso,
      deletedAt: nowIso,
      eligibleCount: toDelete.count,
      updatedCount: typeof result?.changes === 'number' ? result.changes : undefined,
    });
  } catch (error) {
    logger.error('audit.retention_failed', error, { cutoff: cutoffIso });
    process.exitCode = 1;
  } finally {
    closeDatabase();
  }
}

void main();

