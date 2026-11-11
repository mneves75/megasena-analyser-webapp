#!/usr/bin/env bun
/**
 * Sync a live database from the versioned draw seed (db/seed/draws.json) by
 * inserting only the contests it lacks. Runs inside the running container, so
 * there is no file swap, no downtime and no loss of server-side audit_logs or
 * log_events (unlike replacing the whole SQLite file).
 *
 * Append-only by design: existing rows are compared, never rewritten. A contest
 * whose date or numbers differ aborts the import (divergence to investigate);
 * a differing prize field is only reported. Everything happens in one
 * transaction together with the derived caches, and the result must still be a
 * gap-free contest sequence starting at contest 1.
 *
 * Usage: bun run scripts/import-draws.ts <seed.json> [--dry-run]   (honors DATABASE_PATH)
 */

import { readFileSync } from 'node:fs';
import { ZodError } from 'zod';
import { closeDatabase, getDatabase } from '@/lib/db';
import { appendDraws, parseSeedDraws, type Draw } from '@/lib/draw-ingestion';

interface ExistingRow {
  contest_number: number;
  draw_date: string;
  number_1: number;
  number_2: number;
  number_3: number;
  number_4: number;
  number_5: number;
  number_6: number;
  prize_sena: number | null;
  winners_sena: number | null;
  prize_quina: number | null;
  winners_quina: number | null;
  prize_quadra: number | null;
  winners_quadra: number | null;
  total_collection: number | null;
  accumulated: number | null;
  accumulated_value: number | null;
  next_estimated_prize: number | null;
  special_draw: number | null;
}

class ImportError extends Error {}

function fail(message: string): never {
  throw new ImportError(message);
}

function readSeed(file: string): Draw[] {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    fail(`Não foi possível ler ${file}.`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    fail(`JSON inválido em ${file}.`);
  }
  try {
    return parseSeedDraws(json);
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    const issue = error.issues[0];
    fail(`Entrada inválida em [${issue?.path.join('.')}]: ${issue?.message}`);
  }
}

const sameNumbers = (row: ExistingRow, draw: Draw): boolean => {
  const stored = [row.number_1, row.number_2, row.number_3, row.number_4, row.number_5, row.number_6].sort(
    (a, b) => a - b
  );
  const incoming = [...draw.numbers].sort((a, b) => a - b);
  return stored.every((number, index) => number === incoming[index]);
};

/** Prize and accumulation data; reported when it differs, never rewritten. */
const samePrizeData = (row: ExistingRow, draw: Draw): boolean =>
  (row.prize_sena ?? 0) === (draw.prizeSena ?? 0) &&
  (row.winners_sena ?? 0) === draw.winnersSena &&
  (row.prize_quina ?? 0) === (draw.prizeQuina ?? 0) &&
  (row.winners_quina ?? 0) === draw.winnersQuina &&
  (row.prize_quadra ?? 0) === (draw.prizeQuadra ?? 0) &&
  (row.winners_quadra ?? 0) === draw.winnersQuadra &&
  (row.total_collection ?? 0) === (draw.totalCollection ?? 0) &&
  Boolean(row.accumulated) === draw.accumulated &&
  (row.accumulated_value ?? 0) === (draw.accumulatedValue ?? 0) &&
  (row.next_estimated_prize ?? 0) === (draw.nextEstimatedPrize ?? 0) &&
  Boolean(row.special_draw) === draw.specialDraw;

/**
 * The archive after the import must stay a gap-free contest sequence from
 * contest 1 whose dates increase with the contest number. Checked before
 * writing, so --dry-run gives the same verdict as a real run; appendDraws
 * enforces the sequence again inside the transaction.
 */
function assertSequence(existing: Map<number, ExistingRow>, toInsert: Draw[]): void {
  const merged = [
    ...[...existing.values()].map((row) => ({ contest: row.contest_number, date: row.draw_date, isNew: false })),
    ...toInsert.map((draw) => ({ contest: draw.contest, date: draw.date, isNew: true })),
  ].sort((a, b) => a.contest - b.contest);
  const last = merged.at(-1);
  if (last && merged.length !== last.contest) {
    fail(`A importação deixaria lacunas: ${merged.length} concursos entre 1 e ${last.contest}.`);
  }
  merged.forEach((entry, index) => {
    const previous = merged[index - 1];
    if (previous && (entry.isNew || previous.isNew) && entry.date <= previous.date) {
      fail(
        `Datas fora de ordem: concurso ${entry.contest} (${entry.date}) não é posterior ao ${previous.contest} (${previous.date}).`
      );
    }
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) {
    fail('Uso: bun run scripts/import-draws.ts <seed.json> [--dry-run]');
  }

  const seed = readSeed(file);
  const db = getDatabase();
  const existing = new Map(
    (
      db
        .prepare(
          `SELECT contest_number, draw_date,
                  number_1, number_2, number_3, number_4, number_5, number_6,
                  prize_sena, winners_sena, prize_quina, winners_quina, prize_quadra, winners_quadra,
                  total_collection, accumulated, accumulated_value, next_estimated_prize, special_draw
           FROM draws`
        )
        .all() as ExistingRow[]
    ).map((row) => [row.contest_number, row] as const)
  );

  const diverged: number[] = [];
  const prizeDifferences: number[] = [];
  const toInsert: Draw[] = [];
  for (const draw of seed) {
    const row = existing.get(draw.contest);
    if (!row) {
      toInsert.push(draw);
    } else if (row.draw_date !== draw.date || !sameNumbers(row, draw)) {
      diverged.push(draw.contest);
    } else if (!samePrizeData(row, draw)) {
      prizeDifferences.push(draw.contest);
    }
  }
  if (diverged.length > 0) {
    fail(`Concursos divergentes do banco (data ou dezenas): ${diverged.join(', ')}.`);
  }

  assertSequence(existing, toInsert);

  const plan = {
    toInsert: toInsert.map((draw) => draw.contest),
    alreadyPresent: seed.length - toInsert.length,
    prizeDifferences,
  };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...plan }));
    return;
  }

  // IMMEDIATE takes the write lock up front; busy_timeout (lib/db) absorbs the
  // app's own short audit writes.
  db.exec('BEGIN IMMEDIATE');
  try {
    // A contest stored by another writer since the plan is skipped, so this is the real count.
    const inserted = appendDraws(toInsert);
    const range = db
      .prepare('SELECT COUNT(*) AS count, MAX(contest_number) AS last FROM draws')
      .get() as { count: number; last: number | null };
    db.exec('COMMIT');
    console.log(
      JSON.stringify({ inserted, ...plan, totalDraws: range.count, lastContest: range.last })
    );
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      // Keep the original failure as the reported cause.
      console.error('ROLLBACK falhou:', rollbackError);
    }
    throw error;
  }
}

try {
  main();
  closeDatabase();
} catch (error) {
  closeDatabase();
  console.error(error instanceof ImportError ? error.message : error);
  process.exit(1);
}
