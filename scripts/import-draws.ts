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
 * gap-free contest sequence.
 *
 * Usage: bun run scripts/import-draws.ts <seed.json> [--dry-run]   (honors DATABASE_PATH)
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { closeDatabase, getDatabase } from '@/lib/db';
import { PairAnalysisEngine } from '@/lib/analytics/pair-analysis';
import { StatisticsEngine } from '@/lib/analytics/statistics';

const nullablePrize = z.number().nonnegative().nullable();
const winners = z.number().int().nonnegative();

const seedDrawSchema = z.object({
  contest: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve estar em YYYY-MM-DD'),
  numbers: z
    .array(z.number().int().min(1).max(60))
    .length(6)
    .refine((numbers) => new Set(numbers).size === 6, 'dezenas repetidas'),
  prizeSena: nullablePrize,
  winnersSena: winners,
  prizeQuina: nullablePrize,
  winnersQuina: winners,
  prizeQuadra: nullablePrize,
  winnersQuadra: winners,
  totalCollection: nullablePrize,
  accumulated: z.boolean(),
  accumulatedValue: nullablePrize,
  nextEstimatedPrize: nullablePrize,
  specialDraw: z.boolean(),
});

type SeedDraw = z.infer<typeof seedDrawSchema>;

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
  prize_quina: number | null;
  prize_quadra: number | null;
}

class ImportError extends Error {}

function fail(message: string): never {
  throw new ImportError(message);
}

function readSeed(file: string): SeedDraw[] {
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
  const parsed = z.array(seedDrawSchema).safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(`Entrada inválida em [${issue?.path.join('.')}]: ${issue?.message}`);
  }
  const seen = new Set<number>();
  for (const draw of parsed.data) {
    if (seen.has(draw.contest)) {
      fail(`Concurso ${draw.contest} duplicado na entrada.`);
    }
    seen.add(draw.contest);
  }
  return parsed.data;
}

const sameNumbers = (row: ExistingRow, draw: SeedDraw): boolean => {
  const stored = [row.number_1, row.number_2, row.number_3, row.number_4, row.number_5, row.number_6].sort(
    (a, b) => a - b
  );
  const incoming = [...draw.numbers].sort((a, b) => a - b);
  return stored.every((number, index) => number === incoming[index]);
};

const samePrizes = (row: ExistingRow, draw: SeedDraw): boolean =>
  (row.prize_sena ?? 0) === (draw.prizeSena ?? 0) &&
  (row.prize_quina ?? 0) === (draw.prizeQuina ?? 0) &&
  (row.prize_quadra ?? 0) === (draw.prizeQuadra ?? 0);

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
                  prize_sena, prize_quina, prize_quadra
           FROM draws`
        )
        .all() as ExistingRow[]
    ).map((row) => [row.contest_number, row] as const)
  );

  const diverged: number[] = [];
  const prizeDifferences: number[] = [];
  const toInsert: SeedDraw[] = [];
  for (const draw of seed) {
    const row = existing.get(draw.contest);
    if (!row) {
      toInsert.push(draw);
    } else if (row.draw_date !== draw.date || !sameNumbers(row, draw)) {
      diverged.push(draw.contest);
    } else if (!samePrizes(row, draw)) {
      prizeDifferences.push(draw.contest);
    }
  }
  if (diverged.length > 0) {
    fail(`Concursos divergentes do banco (data ou dezenas): ${diverged.join(', ')}.`);
  }

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
    const insert = db.prepare(`
      INSERT INTO draws (
        contest_number, draw_date,
        number_1, number_2, number_3, number_4, number_5, number_6,
        prize_sena, winners_sena, prize_quina, winners_quina, prize_quadra, winners_quadra,
        total_collection, accumulated, accumulated_value, next_estimated_prize, special_draw
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const draw of toInsert) {
      const numbers = [...draw.numbers].sort((a, b) => a - b);
      insert.run(
        draw.contest,
        draw.date,
        ...numbers,
        draw.prizeSena ?? 0,
        draw.winnersSena,
        draw.prizeQuina ?? 0,
        draw.winnersQuina,
        draw.prizeQuadra ?? 0,
        draw.winnersQuadra,
        draw.totalCollection ?? 0,
        draw.accumulated ? 1 : 0,
        draw.accumulatedValue ?? 0,
        draw.nextEstimatedPrize ?? 0,
        draw.specialDraw ? 1 : 0
      );
    }

    const range = db
      .prepare('SELECT COUNT(*) AS count, MIN(contest_number) AS first, MAX(contest_number) AS last FROM draws')
      .get() as { count: number; first: number | null; last: number | null };
    if (range.first !== null && range.last !== null && range.count !== range.last - range.first + 1) {
      fail(`A importação deixaria lacunas: ${range.count} concursos entre ${range.first} e ${range.last}.`);
    }

    if (toInsert.length > 0) {
      new StatisticsEngine().updateNumberFrequencies();
      new PairAnalysisEngine().updatePairFrequencies();
    }
    db.exec('COMMIT');
    console.log(
      JSON.stringify({ inserted: toInsert.length, ...plan, totalDraws: range.count, lastContest: range.last })
    );
  } catch (error) {
    db.exec('ROLLBACK');
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
