#!/usr/bin/env bun

import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';

const databasePath =
  process.env['DATABASE_PATH'] ?? path.join(process.cwd(), '.tmp', 'e2e', 'mega-sena.db');

process.env['DATABASE_PATH'] = databasePath;

await mkdir(path.dirname(databasePath), { recursive: true });

for (const suffix of ['', '-shm', '-wal']) {
  await rm(`${databasePath}${suffix}`, { force: true });
}

const { closeDatabase, getDatabase, runMigrations } = await import('@/lib/db');
const { StatisticsEngine } = await import('@/lib/analytics/statistics');

runMigrations();

const db = getDatabase();
db.prepare('DELETE FROM draws').run();
db.prepare('UPDATE number_frequency SET frequency = 0, last_drawn_contest = NULL, last_drawn_date = NULL').run();

const insertDraw = db.prepare(`
  INSERT INTO draws (
    contest_number, draw_date,
    number_1, number_2, number_3, number_4, number_5, number_6,
    prize_sena, winners_sena, prize_quina, winners_quina, prize_quadra, winners_quadra,
    total_collection, accumulated, accumulated_value, next_estimated_prize,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Real ingestion lags the draw by days (the VPS cannot reach CAIXA), so each
// seeded draw is "loaded" three days after it happened. Sitemap lastmod must
// follow these load timestamps, not the draw dates. Contest 3002 is also
// corrected later (see CORRECTED_AT), which must move the lastmod of every page
// whose content depends on it.
const CORRECTED_CONTEST = 3002;
const CORRECTED_AT = '2026-05-20 12:00:00';

function loadedAt(drawDate: string): string {
  const date = new Date(`${drawDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 3);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

const draws = [
  { contest: 3001, date: '2026-05-02', numbers: [4, 12, 23, 31, 45, 58], accumulated: 0 },
  { contest: 3002, date: '2026-05-04', numbers: [1, 9, 18, 27, 36, 54], accumulated: 1 },
  { contest: 3003, date: '2026-05-06', numbers: [6, 14, 22, 30, 38, 46], accumulated: 0 },
  { contest: 3004, date: '2026-05-08', numbers: [3, 11, 19, 28, 37, 55], accumulated: 1 },
  { contest: 3005, date: '2026-05-10', numbers: [7, 15, 24, 33, 42, 60], accumulated: 0 },
  { contest: 3006, date: '2026-05-12', numbers: [2, 10, 18, 26, 34, 52], accumulated: 1 },
];

for (const draw of draws) {
  insertDraw.run(
    draw.contest,
    draw.date,
    ...draw.numbers,
    2_000_000,
    draw.accumulated ? 0 : 1,
    45_000,
    80,
    900,
    6_000,
    40_000_000,
    draw.accumulated,
    draw.accumulated ? 5_000_000 : 0,
    10_000_000,
    loadedAt(draw.date),
    draw.contest === CORRECTED_CONTEST ? CORRECTED_AT : loadedAt(draw.date)
  );
}

new StatisticsEngine().updateNumberFrequencies();
closeDatabase();

console.log(`Banco E2E preparado em ${databasePath} com ${draws.length} sorteios.`);
