#!/usr/bin/env bun
/**
 * Prune audit_logs or log_events past their retention window (the approved
 * hard-delete exception). `bun run audit:prune` and `bun run log:prune` call it.
 *
 * `audit` defaults to AUDIT_RETENTION_DAYS, or 400 days when that is not a
 * positive number. `log` always defaults to 30 days: it does not read
 * LOG_RETENTION_DAYS, which configures only the server's scheduler.
 */

import { closeDatabase } from '@/lib/db';
import { logger, registerLogSink } from '@/lib/logger';
import { enqueueLogEvent, stopLogWriter } from '@/lib/log-store';
import { runRetention, type RetentionTable } from '@/lib/retention';

const USAGE =
  'Usage: bun run scripts/prune-retention.ts <audit|log> [--days N | --before ISO_DATE] [--dry-run]\n' +
  'Examples:\n' +
  '  bun run audit:prune -- --days 365\n' +
  '  bun run log:prune -- --before 2025-01-01T00:00:00.000Z --dry-run';

function auditDefaultDays(): number {
  const configured = Number(process.env['AUDIT_RETENTION_DAYS'] ?? '400');
  return Number.isFinite(configured) && configured > 0 ? configured : 400;
}

const targets = {
  audit: { table: 'audit_logs', events: 'audit', defaultDays: auditDefaultDays },
  log: { table: 'log_events', events: 'log', defaultDays: () => 30 },
} as const satisfies Record<string, { table: RetentionTable; events: string; defaultDays: () => number }>;

type ParsedArgs = {
  target: keyof typeof targets;
  days?: number;
  before?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [target, ...rest] = argv;
  if (target !== 'audit' && target !== 'log') {
    throw new Error(USAGE);
  }
  const args: ParsedArgs = { target, dryRun: false };

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token === '--days') {
      const value = rest[i + 1];
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
      const value = rest[i + 1];
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
      throw new Error(USAGE);
    }
  }

  return args;
}

async function main(): Promise<void> {
  if (typeof globalThis.Bun !== 'undefined') {
    registerLogSink((entry) => {
      enqueueLogEvent(entry);
    });
  }

  const parsed = parseArgs(process.argv.slice(2));
  const { table, events, defaultDays } = targets[parsed.target];
  const retentionDays = typeof parsed.days === 'number' ? parsed.days : defaultDays();
  const cutoffIso = parsed.before ?? new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  logger.info(`${events}.retention_started`, {
    cutoff: cutoffIso,
    retentionDays: parsed.before ? undefined : retentionDays,
    dryRun: parsed.dryRun,
  });

  try {
    await runRetention(table, {
      dryRun: parsed.dryRun,
      reason: 'cli',
      ...(parsed.before ? { beforeIso: parsed.before } : { retentionDays }),
    });
  } catch (error) {
    logger.error(`${events}.retention_failed`, error, { cutoff: cutoffIso });
    process.exitCode = 1;
  } finally {
    await stopLogWriter();
    closeDatabase();
  }
}

void main();
