#!/usr/bin/env bun
/**
 * Export the public CAIXA draw history to a versionable JSON seed.
 *
 * Only the `draws` table is exported (public lottery data, no PII). The internal
 * `id` and local ingestion timestamps (`created_at`/`updated_at`) are dropped so
 * the output is stable and diff-friendly: re-running after `pull-draws` only
 * appends the new contests. Telemetry tables (audit_logs/log_events) are never
 * touched.
 *
 * Usage: bun run scripts/export-draws.ts   (honors DATABASE_PATH)
 */

import { Database } from 'bun:sqlite';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

interface DrawSeed {
  contest: number;
  date: string;
  numbers: number[];
  prizeSena: number | null;
  winnersSena: number;
  prizeQuina: number | null;
  winnersQuina: number;
  prizeQuadra: number | null;
  winnersQuadra: number;
  totalCollection: number | null;
  accumulated: boolean;
  accumulatedValue: number | null;
  nextEstimatedPrize: number | null;
  specialDraw: boolean;
}

interface DrawRow {
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

function nullableNumber(value: number | null): number | null {
  return value === null ? null : Number(value);
}

function toSeed(row: DrawRow): DrawSeed {
  return {
    contest: Number(row.contest_number),
    date: String(row.draw_date),
    numbers: [
      row.number_1,
      row.number_2,
      row.number_3,
      row.number_4,
      row.number_5,
      row.number_6,
    ].map(Number),
    prizeSena: nullableNumber(row.prize_sena),
    winnersSena: Number(row.winners_sena ?? 0),
    prizeQuina: nullableNumber(row.prize_quina),
    winnersQuina: Number(row.winners_quina ?? 0),
    prizeQuadra: nullableNumber(row.prize_quadra),
    winnersQuadra: Number(row.winners_quadra ?? 0),
    totalCollection: nullableNumber(row.total_collection),
    accumulated: Boolean(row.accumulated),
    accumulatedValue: nullableNumber(row.accumulated_value),
    nextEstimatedPrize: nullableNumber(row.next_estimated_prize),
    specialDraw: Boolean(row.special_draw),
  };
}

function main(): void {
  const dbPath = process.env['DATABASE_PATH']
    ? path.resolve(process.env['DATABASE_PATH'])
    : path.join(process.cwd(), 'db', 'mega-sena.db');
  const outPath = path.join(process.cwd(), 'db', 'seed', 'draws.json');

  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .query(
        `SELECT contest_number, draw_date,
                number_1, number_2, number_3, number_4, number_5, number_6,
                prize_sena, winners_sena, prize_quina, winners_quina,
                prize_quadra, winners_quadra, total_collection,
                accumulated, accumulated_value, next_estimated_prize, special_draw
         FROM draws
         ORDER BY contest_number ASC`
      )
      .all() as DrawRow[];

    const seed = rows.map(toSeed);

    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');

    const first = seed.at(0)?.contest;
    const last = seed.at(-1)?.contest;
    console.log(
      `Exported ${seed.length} draws to ${path.relative(process.cwd(), outPath)} (contests ${first}-${last}).`
    );
  } finally {
    db.close();
  }
}

main();
