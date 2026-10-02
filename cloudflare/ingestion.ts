import { z } from 'zod';
import { CaixaAPIClient, type MegaSenaDrawData } from '@/lib/api/caixa-client';
import { StatisticsEngine } from '@/lib/analytics/statistics';
import { PairAnalysisEngine } from '@/lib/analytics/pair-analysis';
import { normalizeMegaSenaNumbers } from '@/lib/analytics/draw-validation';
import { withDatabaseTransaction, type DatabaseLike } from '@/lib/db-transaction';
import { runWithDatabase } from '@/lib/cloudflare/database';
import { toIsoDate } from '@/lib/utils';

const money = z.number().finite().nonnegative().nullable();
const winners = z.number().int().nonnegative();
const seedSchema = z.object({
  contest: z.number().int().positive(), date: z.string(),
  numbers: z.array(z.number().int().min(1).max(60)).length(6),
  prizeSena: money, winnersSena: winners, prizeQuina: money, winnersQuina: winners,
  prizeQuadra: money, winnersQuadra: winners, totalCollection: money,
  accumulated: z.boolean(), accumulatedValue: money, nextEstimatedPrize: money,
  specialDraw: z.boolean(),
});

export interface DrawSource {
  fetchDraw(contest?: number): Promise<MegaSenaDrawData>;
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

function drawValues(draw: MegaSenaDrawData): unknown[] {
  if (!Number.isInteger(draw.numero) || draw.numero < 1) throw new Error('Invalid contest number.');
  const numbers = normalizeMegaSenaNumbers(draw.listaDezenas);
  const tier = (name: string) => draw.rateioProcessamento?.find(item => item.descricaoFaixa === name);
  const values = [
    tier('Sena')?.valorPremio ?? 0, tier('Sena')?.numeroDeGanhadores ?? 0,
    tier('Quina')?.valorPremio ?? 0, tier('Quina')?.numeroDeGanhadores ?? 0,
    tier('Quadra')?.valorPremio ?? 0, tier('Quadra')?.numeroDeGanhadores ?? 0,
    draw.valorArrecadado ?? 0, draw.acumulado ? 1 : 0,
    draw.valorAcumuladoConcurso ?? 0, draw.valorEstimadoProximoConcurso ?? 0,
    draw.concursoEspecial ? 1 : 0,
  ];
  if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid draw prize data.');
  for (const index of [1, 3, 5]) {
    if (!Number.isInteger(values[index])) throw new Error('Invalid draw winner count.');
  }
  return [draw.numero, toIsoDate(draw.dataApuracao), ...numbers, ...values];
}

function appendValues(database: DatabaseLike, entries: unknown[][]): number {
  return runWithDatabase(database, () => withDatabaseTransaction(database, () => {
    const insert = database.prepare(insertSql);
    let inserted = 0;
    for (const values of entries) {
      const existing = database.prepare(`SELECT draw_date, number_1, number_2, number_3,
        number_4, number_5, number_6 FROM draws WHERE contest_number = ?`).get(values[0]) as Record<string, unknown> | undefined;
      if (existing) {
        const stored = [existing['draw_date'], ...Array.from({ length: 6 }, (_, index) => existing[`number_${index + 1}`])];
        if (stored.some((value, index) => value !== values[index + 1])) {
          throw new Error(`Existing contest ${values[0]} conflicts with incoming date or numbers.`);
        }
      }
      inserted += (insert.run(...values) as { changes: number }).changes;
    }
    const sequence = database.prepare('SELECT COUNT(*) AS count, COALESCE(MAX(contest_number), 0) AS last FROM draws').get() as { count: number; last: number };
    if (sequence.count !== sequence.last) throw new Error('Draw import must preserve a gap-free contest sequence.');
    if (inserted > 0) {
      new StatisticsEngine().updateNumberFrequencies();
      new PairAnalysisEngine().updatePairFrequencies();
    }
    return inserted;
  }));
}

export function appendDraws(database: DatabaseLike, draws: MegaSenaDrawData[]): number {
  return appendValues(database, draws.map(drawValues));
}

/** Binding-only administration: append validated public seed rows without replacing existing data. */
export function importSeedDraws(database: DatabaseLike, input: unknown): number {
  const draws = z.array(seedSchema).max(10000).parse(input);
  const seen = new Set<number>();
  const entries = draws.map(draw => {
    if (seen.has(draw.contest)) throw new Error(`Duplicate seed contest ${draw.contest}.`);
    seen.add(draw.contest);
    return [draw.contest, toIsoDate(draw.date), ...normalizeMegaSenaNumbers(draw.numbers),
      draw.prizeSena, draw.winnersSena, draw.prizeQuina, draw.winnersQuina,
      draw.prizeQuadra, draw.winnersQuadra, draw.totalCollection, Number(draw.accumulated),
      draw.accumulatedValue, draw.nextEstimatedPrize, Number(draw.specialDraw)];
  });
  return appendValues(database, entries);
}

export async function refreshDraws(
  database: DatabaseLike,
  source: DrawSource = new CaixaAPIClient({ timeoutMs: 10000, maxRetries: 3, maxRetryDelayMs: 10000 }),
  options: { maxDraws?: number } = {}
): Promise<RefreshResult> {
  const maxDraws = options.maxDraws ?? 5;
  if (!Number.isInteger(maxDraws) || maxDraws < 1 || maxDraws > 20) throw new Error('Refresh batch must contain 1–20 draws.');
  const previous = database.prepare('SELECT COALESCE(MAX(contest_number), 0) AS last FROM draws').get() as { last: number };
  const latest = await source.fetchDraw();
  drawValues(latest);
  if (latest.numero < previous.last) throw new Error('CAIXA latest contest is older than stored data.');
  const end = Math.min(latest.numero, previous.last + maxDraws);
  const draws: MegaSenaDrawData[] = [];
  // All network work completes before the first SQLite write or writer transaction.
  for (let contest = previous.last + 1; contest <= end; contest++) {
    const draw = contest === latest.numero ? latest : await source.fetchDraw(contest);
    if (draw.numero !== contest) throw new Error(`Requested contest ${contest}, received ${draw.numero}.`);
    drawValues(draw);
    draws.push(draw);
  }
  if (draws.length === 0) draws.push(latest);
  const inserted = appendDraws(database, draws);
  const current = database.prepare('SELECT COALESCE(MAX(contest_number), 0) AS last FROM draws').get() as { last: number };
  return { status: current.last === latest.numero ? 'success' : 'incomplete', inserted, lastContest: current.last, latestContest: latest.numero };
}
