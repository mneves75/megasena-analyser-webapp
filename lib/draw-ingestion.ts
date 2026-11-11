/**
 * The shared draw ingestion core. It writes through the ambient `getDatabase()`:
 * the Bun file database locally, and the Durable Object's database in the Worker
 * build, where `vite.config.ts` swaps `@/lib/db` and callers open the scope with
 * `runWithDatabase`.
 */
import { z } from 'zod';
import type { MegaSenaDrawData } from '@/lib/api/caixa-client';
import { StatisticsEngine } from '@/lib/analytics/statistics';
import { PairAnalysisEngine } from '@/lib/analytics/pair-analysis';
import { normalizeMegaSenaNumbers } from '@/lib/analytics/draw-validation';
import { getDatabase } from '@/lib/db';
import { withDatabaseTransaction } from '@/lib/db-transaction';
import { toIsoDate } from '@/lib/utils';

/** A storage-ready draw in the public seed shape: ISO date, six ascending numbers. */
export interface Draw {
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

const money = z.number().finite().nonnegative().nullable();
const winners = z.number().int().nonnegative();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve estar em YYYY-MM-DD')
  .refine((value) => {
    // Runs even when the regex failed, so an unparsable value must not throw.
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'data inexistente no calendário');
const seedDrawSchema = z.object({
  contest: z.number().int().positive(),
  date: isoDate,
  numbers: z
    .array(z.number().int().min(1).max(60))
    .length(6)
    .refine((numbers) => new Set(numbers).size === 6, 'dezenas repetidas')
    .transform((numbers) => [...numbers].sort((a, b) => a - b)),
  prizeSena: money, winnersSena: winners, prizeQuina: money, winnersQuina: winners,
  prizeQuadra: money, winnersQuadra: winners, totalCollection: money,
  accumulated: z.boolean(), accumulatedValue: money, nextEstimatedPrize: money,
  specialDraw: z.boolean(),
});
const seedFileSchema = z
  .array(seedDrawSchema)
  .max(10000)
  .superRefine((draws, context) => {
    const seen = new Set<number>();
    draws.forEach((draw, index) => {
      if (seen.has(draw.contest)) {
        context.addIssue({ code: 'custom', path: [index, 'contest'], message: `Concurso ${draw.contest} duplicado na entrada.` });
      }
      seen.add(draw.contest);
    });
  });

/** The seed-file boundary: strict public seed shape, returned storage-ready. Throws `ZodError`. */
export function parseSeedDraws(input: unknown): Draw[] {
  return seedFileSchema.parse(input);
}

export interface DrawSource {
  fetchDraw(contest?: number): Promise<MegaSenaDrawData>;
}

export class DrawSourceFailure extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

function toDraw(draw: MegaSenaDrawData): Draw {
  if (!Number.isInteger(draw.numero) || draw.numero < 1) throw new Error('Invalid contest number.');
  const numbers = normalizeMegaSenaNumbers(draw.listaDezenas);
  const tier = (name: string) => draw.rateioProcessamento?.find(item => item.descricaoFaixa === name);
  const sena = tier('Sena');
  const quina = tier('Quina');
  const quadra = tier('Quadra');
  const prizes = {
    prizeSena: sena?.valorPremio ?? 0, winnersSena: sena?.numeroDeGanhadores ?? 0,
    prizeQuina: quina?.valorPremio ?? 0, winnersQuina: quina?.numeroDeGanhadores ?? 0,
    prizeQuadra: quadra?.valorPremio ?? 0, winnersQuadra: quadra?.numeroDeGanhadores ?? 0,
    totalCollection: draw.valorArrecadado ?? 0, accumulatedValue: draw.valorAcumuladoConcurso ?? 0,
    nextEstimatedPrize: draw.valorEstimadoProximoConcurso ?? 0,
  };
  if (Object.values(prizes).some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid draw prize data.');
  if (![prizes.winnersSena, prizes.winnersQuina, prizes.winnersQuadra].every(Number.isInteger)) {
    throw new Error('Invalid draw winner count.');
  }
  return {
    contest: draw.numero, date: toIsoDate(draw.dataApuracao), numbers, ...prizes,
    accumulated: Boolean(draw.acumulado), specialDraw: Boolean(draw.concursoEspecial),
  };
}

/** Fetch and convert inside one boundary: any bad payload becomes a source failure. */
async function fetchFromSource(source: DrawSource, contest?: number): Promise<Draw> {
  try {
    const draw = await source.fetchDraw(contest);
    if (contest !== undefined && draw.numero !== contest) throw new Error(`Requested contest ${contest}, received ${draw.numero}.`);
    return toDraw(draw);
  } catch (error) {
    throw new DrawSourceFailure(error);
  }
}

export interface RefreshResult {
  status: 'success' | 'incomplete';
  inserted: number;
  lastContest: number;
  latestContest: number;
}

const insertSql = `INSERT INTO draws (
  contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6,
  prize_sena, winners_sena, prize_quina, winners_quina, prize_quadra, winners_quadra,
  total_collection, accumulated, accumulated_value, next_estimated_prize, special_draw
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(contest_number) DO NOTHING`;

/** The Durable Object adapter rejects boolean and undefined bindings: booleans bind as 0/1. */
function bindings(draw: Draw): (string | number | null)[] {
  return [draw.contest, draw.date, ...draw.numbers,
    draw.prizeSena, draw.winnersSena, draw.prizeQuina, draw.winnersQuina,
    draw.prizeQuadra, draw.winnersQuadra, draw.totalCollection, Number(draw.accumulated),
    draw.accumulatedValue, draw.nextEstimatedPrize, Number(draw.specialDraw)];
}

export function appendDraws(draws: readonly Draw[]): number {
  const database = getDatabase();
  return withDatabaseTransaction(database, () => {
    const insert = database.prepare(insertSql);
    let inserted = 0;
    for (const draw of draws) {
      const values = bindings(draw);
      const existing = database.prepare(`SELECT draw_date, number_1, number_2, number_3,
        number_4, number_5, number_6 FROM draws WHERE contest_number = ?`).get(draw.contest) as Record<string, unknown> | undefined;
      if (existing) {
        const stored = [existing['draw_date'], ...Array.from({ length: 6 }, (_, index) => existing[`number_${index + 1}`])];
        if (stored.some((value, index) => value !== values[index + 1])) {
          throw new Error(`Existing contest ${draw.contest} conflicts with incoming date or numbers.`);
        }
      }
      insert.run(...values);
      // Read the count explicitly: the shared adapter no longer runs
      // `SELECT changes()` on every write, because only this ingestion counter
      // consumes it. `changes()` excludes trigger writes, which is what the
      // sequence/cache bookkeeping expects.
      inserted += (database.prepare('SELECT changes() AS changes').get() as { changes: number }).changes;
    }
    const sequence = database.prepare('SELECT COUNT(*) AS count, COALESCE(MAX(contest_number), 0) AS last FROM draws').get() as { count: number; last: number };
    if (sequence.count !== sequence.last) throw new Error('Draw import must preserve a gap-free contest sequence.');
    if (inserted > 0) {
      new StatisticsEngine().updateNumberFrequencies();
      new PairAnalysisEngine().updatePairFrequencies();
    }
    return inserted;
  });
}

export async function refreshDraws(source: DrawSource, options: { maxDraws?: number } = {}): Promise<RefreshResult> {
  const maxDraws = options.maxDraws ?? 5;
  if (!Number.isInteger(maxDraws) || maxDraws < 1 || maxDraws > 20) throw new Error('Refresh batch must contain 1–20 draws.');
  const database = getDatabase();
  const previous = database.prepare('SELECT COALESCE(MAX(contest_number), 0) AS last FROM draws').get() as { last: number };
  const latest = await fetchFromSource(source);
  if (latest.contest < previous.last) throw new DrawSourceFailure('CAIXA latest contest is older than stored data.');
  const end = Math.min(latest.contest, previous.last + maxDraws);
  const draws: Draw[] = [];
  // All network work completes before the first SQLite write or writer transaction.
  for (let contest = previous.last + 1; contest <= end; contest++) {
    draws.push(contest === latest.contest ? latest : await fetchFromSource(source, contest));
  }
  if (draws.length === 0) draws.push(latest);
  const inserted = appendDraws(draws);
  const current = database.prepare('SELECT COALESCE(MAX(contest_number), 0) AS last FROM draws').get() as { last: number };
  return { status: current.last === latest.contest ? 'success' : 'incomplete', inserted, lastContest: current.last, latestContest: latest.contest };
}
