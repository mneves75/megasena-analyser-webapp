#!/usr/bin/env bun

import { caixaClient, type MegaSenaDrawData } from '@/lib/api/caixa-client';
import { getDatabase, closeDatabase } from '@/lib/db';
import { StatisticsEngine } from '@/lib/analytics/statistics';

interface SaveDrawOptions {
  draw: MegaSenaDrawData;
  db: ReturnType<typeof getDatabase>;
  incremental?: boolean;
}

function saveDraw({ draw, db, incremental = false }: SaveDrawOptions): boolean {
  const numbers = draw.listaDezenas.map(Number).sort((a, b) => a - b);

  if (numbers.length !== 6) {
    console.error(`Invalid draw ${draw.numero}: expected 6 numbers, got ${numbers.length}`);
    return false;
  }

  const senaInfo = draw.rateioProcessamento?.find((r) => r.descricaoFaixa === 'Sena');
  const quinaInfo = draw.rateioProcessamento?.find((r) => r.descricaoFaixa === 'Quina');
  const quadraInfo = draw.rateioProcessamento?.find((r) => r.descricaoFaixa === 'Quadra');

  // Use INSERT OR IGNORE in incremental mode, INSERT OR REPLACE otherwise
  const insertMode = incremental ? 'INSERT OR IGNORE' : 'INSERT OR REPLACE';

  const stmt = db.prepare(`
    ${insertMode} INTO draws (
      contest_number, draw_date,
      number_1, number_2, number_3, number_4, number_5, number_6,
      prize_sena, winners_sena,
      prize_quina, winners_quina,
      prize_quadra, winners_quadra,
      total_collection, accumulated, accumulated_value,
      next_estimated_prize, special_draw,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const result = stmt.run(
    draw.numero,
    draw.dataApuracao,
    numbers[0],
    numbers[1],
    numbers[2],
    numbers[3],
    numbers[4],
    numbers[5],
    senaInfo?.valorPremio || 0,
    senaInfo?.numeroDeGanhadores || 0,
    quinaInfo?.valorPremio || 0,
    quinaInfo?.numeroDeGanhadores || 0,
    quadraInfo?.valorPremio || 0,
    quadraInfo?.numeroDeGanhadores || 0,
    draw.valorArrecadado || 0,
    draw.acumulado ? 1 : 0,
    draw.valorAcumuladoConcurso || 0,
    draw.valorEstimadoProximoConcurso || 0,
    draw.tipoJogo === 'MEGA_SENA' ? 0 : 1
  ) as { changes: number; lastInsertRowid: number };

  // Return true if a new row was inserted (changes > 0)
  return result.changes > 0;
}

async function main() {
  const args = process.argv.slice(2);
  const limitFlag = args.indexOf('--limit');
  const startFlag = args.indexOf('--start');
  const endFlag = args.indexOf('--end');
  const incrementalFlag = args.indexOf('--incremental');

  let limit: number | undefined;
  let start = 1;
  let end: number | undefined;
  const incremental = incrementalFlag !== -1;

  if (limitFlag !== -1 && args[limitFlag + 1]) {
    limit = parseInt(args[limitFlag + 1], 10);
  }

  if (startFlag !== -1 && args[startFlag + 1]) {
    start = parseInt(args[startFlag + 1], 10);
  }

  if (endFlag !== -1 && args[endFlag + 1]) {
    end = parseInt(args[endFlag + 1], 10);
  }

  console.log('Starting Mega-Sena data ingestion...');
  console.log(`Mode: ${incremental ? 'Incremental (only new draws)' : 'Full (replace existing)'}`);
  console.log(`Start contest: ${start}`);
  if (end) console.log(`End contest: ${end}`);
  if (limit) console.log(`Limit: ${limit} draws`);

  const db = getDatabase();

  // Counters for statistics
  let newDraws = 0;
  let skippedDraws = 0;

  try {
    // Begin transaction for batch inserts
    db.exec('BEGIN TRANSACTION');

    if (limit) {
      // Fetch only the latest draws
      console.log(`Fetching latest draw...`);
      const latestDraw = await caixaClient.fetchDraw();
      const startContest = Math.max(1, latestDraw.numero - limit + 1);

      console.log(`Fetching draws from ${startContest} to ${latestDraw.numero}...`);

      for (let contest = startContest; contest <= latestDraw.numero; contest++) {
        const draw = await caixaClient.fetchDraw(contest);
        const wasInserted = saveDraw({ draw, db, incremental });

        if (wasInserted) {
          newDraws++;
          console.log(`[OK] Added draw #${contest}`);
        } else {
          skippedDraws++;
          if (incremental) {
            console.log(`[SKIP] Skipped draw #${contest} (already exists)`);
          }
        }
      }
    } else {
      // Fetch range of draws
      const draws = await caixaClient.fetchAllDraws(start, end);

      console.log(`\nProcessing ${draws.length} draws...`);

      for (const draw of draws) {
        const wasInserted = saveDraw({ draw, db, incremental });

        if (wasInserted) {
          newDraws++;
        } else {
          skippedDraws++;
        }
      }
    }

    // Commit transaction
    db.exec('COMMIT');

    console.log('\n[OK] Data ingestion completed');

    // Show ingestion statistics
    console.log(`\nIngestion Statistics:`);
    console.log(`  New draws added: ${newDraws}`);
    if (incremental && skippedDraws > 0) {
      console.log(`  Skipped (already exist): ${skippedDraws}`);
    } else if (!incremental && skippedDraws > 0) {
      console.log(`  Updated draws: ${skippedDraws}`);
    }
    console.log(`  Total processed: ${newDraws + skippedDraws}`);

    console.log('\nUpdating statistics...');

    const stats = new StatisticsEngine();
    stats.updateNumberFrequencies();

    console.log('[OK] Statistics updated');

    const summary = stats.getDrawStatistics();
    console.log(`\nDatabase Summary:`);
    console.log(`  Total draws: ${summary.totalDraws}`);
    console.log(`  Last draw: #${summary.lastContestNumber} (${summary.lastDrawDate})`);
    console.log(`  Accumulated draws: ${summary.accumulatedCount} (${summary.accumulationRate.toFixed(1)}%)`);

  } catch (error) {
    // Rollback transaction on error
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors if transaction wasn't started
    }
    console.error('\n[ERROR] Error during ingestion:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

main();
