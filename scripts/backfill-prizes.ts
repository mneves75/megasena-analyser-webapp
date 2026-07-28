#!/usr/bin/env bun
/**
 * Backfill prize columns for draws already stored in the database.
 *
 * Why this exists: the historical bulk import predates the current
 * `listaRateioPremio` / `faixa` handling in `lib/api/caixa-client.ts`, so rows
 * below roughly contest 2400 landed with `prize_sena`/`prize_quina`/
 * `prize_quadra` = 0 even though CAIXA serves the full breakdown for every
 * contest. That made `PrizeCorrelationEngine` average over ~10 draws and render
 * "R$ 0,00 / 0x" for most numbers on /dashboard/statistics.
 *
 * `pull-draws.ts` would also repair this, but it re-fetches and rewrites every
 * column of every contest under one long transaction. This script only touches
 * the prize columns, commits in batches, and is resumable, so it is the safe
 * option to run against a populated production database.
 *
 * Usage:
 *   bun run db:backfill-prizes                 # only rows missing prize data
 *   bun run db:backfill-prizes -- --all        # re-fetch every stored contest
 *   bun run db:backfill-prizes -- --limit 100  # cap the number of contests
 *   bun run db:backfill-prizes -- --delay 500  # ms between CAIXA requests
 */

import { normalizePrizeDescription } from '@/lib/api/caixa-client';
import { API_CONFIG } from '@/lib/constants';
import { getDatabase, closeDatabase } from '@/lib/db';
import { StatisticsEngine } from '@/lib/analytics/statistics';
import { PairAnalysisEngine } from '@/lib/analytics/pair-analysis';
import { logger } from '@/lib/logger';

const DEFAULT_DELAY_MS = 350;
const COMMIT_BATCH_SIZE = 100;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_CONSECUTIVE_FAILURES = 25;

interface PrizeTier {
  faixa?: number;
  descricaoFaixa?: string;
  valorPremio?: number;
  numeroDeGanhadores?: number;
}

interface CaixaDraw {
  numero: number;
  listaRateioPremio?: PrizeTier[];
  rateioProcessamento?: PrizeTier[];
  valorArrecadado?: number;
  acumulado?: boolean;
  valorAcumuladoConcurso?: number;
  valorAcumuladoProximoConcurso?: number;
  valorEstimadoProximoConcurso?: number;
}

/**
 * CAIXA alternates between `rateioProcessamento` and `listaRateioPremio`, and
 * between a numeric `faixa` and a `descricaoFaixa` string that reads either
 * "Sena" or "6 acertos" depending on the contest era. Match on both.
 */
function findPrizeTier(draw: CaixaDraw, faixa: number, descricao: string): PrizeTier | undefined {
  const tiers =
    Array.isArray(draw.rateioProcessamento) && draw.rateioProcessamento.length > 0
      ? draw.rateioProcessamento
      : Array.isArray(draw.listaRateioPremio)
        ? draw.listaRateioPremio
        : [];

  return tiers.find((tier) => {
    if (tier.faixa === faixa) {
      return true;
    }
    return normalizePrizeDescription(tier.descricaoFaixa, tier.faixa) === descricao;
  });
}

function parseIntArg(args: string[], flag: string): number | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  const raw = args[index + 1];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function fetchDraw(contest: number): Promise<CaixaDraw | null> {
  const response = await fetch(`${API_CONFIG.CAIXA_BASE_URL}/megasena/${contest}`, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Referer: 'https://loterias.caixa.gov.br/',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    return null;
  }

  const draw = (await response.json()) as CaixaDraw;
  return typeof draw?.numero === 'number' ? draw : null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const refetchAll = args.includes('--all');
  const limit = parseIntArg(args, '--limit');
  const delayMs = parseIntArg(args, '--delay') ?? DEFAULT_DELAY_MS;

  const db = getDatabase();

  // "Missing" means no prize tier at all. A genuine accumulated draw still pays
  // quina and quadra, so prize_quina = 0 AND prize_quadra = 0 is the reliable
  // signal that the row never received its breakdown — prize_sena = 0 alone is
  // normal and would re-fetch two thirds of the table for nothing.
  const selectSql = refetchAll
    ? 'SELECT contest_number FROM draws ORDER BY contest_number'
    : `SELECT contest_number FROM draws
       WHERE COALESCE(prize_quina, 0) = 0 AND COALESCE(prize_quadra, 0) = 0
       ORDER BY contest_number`;

  const rows = db.prepare(selectSql).all() as Array<{ contest_number: number }>;
  const contests = rows.map((row) => row.contest_number).slice(0, limit ?? rows.length);

  console.log(`Contests to backfill: ${contests.length}${limit ? ` (limited to ${limit})` : ''}`);
  if (contests.length === 0) {
    console.log('[OK] Nothing to do — every stored draw already has prize data.');
    closeDatabase();
    return;
  }

  const estimatedMinutes = ((contests.length * (delayMs + 150)) / 60000).toFixed(1);
  console.log(`Request spacing: ${delayMs}ms — estimated ${estimatedMinutes} min`);

  const update = db.prepare(`
    UPDATE draws SET
      prize_sena = ?,
      winners_sena = ?,
      prize_quina = ?,
      winners_quina = ?,
      prize_quadra = ?,
      winners_quadra = ?,
      total_collection = ?,
      accumulated = ?,
      accumulated_value = ?,
      next_estimated_prize = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE contest_number = ?
  `);

  let updated = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let inTransaction = false;

  const beginBatch = (): void => {
    db.exec('BEGIN TRANSACTION');
    inTransaction = true;
  };
  const commitBatch = (): void => {
    if (inTransaction) {
      db.exec('COMMIT');
      inTransaction = false;
    }
  };

  try {
    beginBatch();

    for (const [index, contest] of contests.entries()) {
      let draw: CaixaDraw | null = null;
      try {
        draw = await fetchDraw(contest);
      } catch (error) {
        logger.warn('backfill.fetch_failed', {
          contest,
          reason: error instanceof Error ? error.message : String(error),
        });
      }

      if (!draw) {
        failed++;
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(
            `Aborting: ${consecutiveFailures} consecutive CAIXA failures (last contest ${contest}). ` +
              'Progress up to the previous batch is committed; re-run to resume.'
          );
        }
        await delay(delayMs * 3);
        continue;
      }

      consecutiveFailures = 0;
      const sena = findPrizeTier(draw, 1, 'Sena');
      const quina = findPrizeTier(draw, 2, 'Quina');
      const quadra = findPrizeTier(draw, 3, 'Quadra');

      update.run(
        sena?.valorPremio ?? 0,
        sena?.numeroDeGanhadores ?? 0,
        quina?.valorPremio ?? 0,
        quina?.numeroDeGanhadores ?? 0,
        quadra?.valorPremio ?? 0,
        quadra?.numeroDeGanhadores ?? 0,
        draw.valorArrecadado ?? 0,
        draw.acumulado ? 1 : 0,
        draw.valorAcumuladoConcurso ?? draw.valorAcumuladoProximoConcurso ?? 0,
        draw.valorEstimadoProximoConcurso ?? 0,
        contest
      );
      updated++;

      if ((index + 1) % COMMIT_BATCH_SIZE === 0) {
        commitBatch();
        console.log(
          `  ${index + 1}/${contests.length} processed (updated ${updated}, failed ${failed})`
        );
        beginBatch();
      }

      await delay(delayMs);
    }

    commitBatch();
  } catch (error) {
    // Commit whatever the current batch already applied so a re-run resumes
    // instead of repeating work; the loop only aborts on sustained API failure.
    try {
      commitBatch();
    } catch {
      // Ignore: nothing to commit.
    }
    console.error('[ERROR] Backfill interrupted:', error instanceof Error ? error.message : error);
    console.error(`Committed ${updated} updates before stopping. Re-run to resume.`);
    closeDatabase();
    process.exit(1);
  }

  console.log(`\n[OK] Backfill complete: ${updated} updated, ${failed} failed`);

  console.log('Rebuilding frequency and pair caches...');
  new StatisticsEngine().updateNumberFrequencies();
  new PairAnalysisEngine().updatePairFrequencies();
  console.log('[OK] Caches rebuilt');

  const summary = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN prize_sena > 0 THEN 1 ELSE 0 END) AS senaWithPrize,
              SUM(CASE WHEN prize_quina > 0 THEN 1 ELSE 0 END) AS quinaWithPrize
       FROM draws`
    )
    .get() as { total: number; senaWithPrize: number; quinaWithPrize: number };

  console.log(
    `Draws: ${summary.total} | with sena prize: ${summary.senaWithPrize} | with quina prize: ${summary.quinaWithPrize}`
  );

  closeDatabase();
}

main();
