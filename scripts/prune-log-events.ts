#!/usr/bin/env bun

import { closeDatabase } from '@/lib/db';
import { logger, registerLogSink } from '@/lib/logger';
import { enqueueLogEvent, stopLogWriter } from '@/lib/log-store';
import { runLogRetention } from '@/lib/log-retention';

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
        'Usage: bun run scripts/prune-log-events.ts [--days N | --before ISO_DATE] [--dry-run]\n' +
          'Examples:\n' +
          '  bun run scripts/prune-log-events.ts --days 30\n' +
          '  bun run scripts/prune-log-events.ts --before 2025-01-01T00:00:00.000Z --dry-run'
      );
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
  const retentionDays = typeof parsed.days === 'number' ? parsed.days : 30;
  const cutoffIso = parsed.before ?? new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  logger.info('log.retention_started', {
    cutoff: cutoffIso,
    retentionDays: parsed.before ? undefined : retentionDays,
    dryRun: parsed.dryRun,
  });

  try {
    await runLogRetention({
      dryRun: parsed.dryRun,
      reason: 'cli',
      ...(parsed.before ? { beforeIso: parsed.before } : { retentionDays }),
    });
  } catch (error) {
    logger.error('log.retention_failed', error, { cutoff: cutoffIso });
    process.exitCode = 1;
  } finally {
    await stopLogWriter();
    closeDatabase();
  }
}

void main();
