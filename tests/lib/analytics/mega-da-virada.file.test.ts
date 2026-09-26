import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Which stored contests the archive treats as Mega da Virada editions, against
 * a real SQLite file:
 * - 2810: listed edition, stored without the special flag (every row loaded
 *   before v1.16.0 has special_draw = 0);
 * - 3000 and 3030: new editions recognised from the ingested flag, 3030 drawn
 *   in January and so closing the previous year;
 * - 3010: flagged special but drawn in May (like the real Mega 30 Anos);
 * - 3021: flagged, year-end, but not a contest ending in 0 or 5;
 * - 3025: year-end contest ending in 5 without the flag.
 */
describe('Mega da Virada in the draw archive (sqlite file)', () => {
  it('lists listed and newly flagged year-end editions only, with their own lastmod', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-virada-'));
    const dbPath = path.join(tempDir, 'virada.db');

    try {
      const run = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
            "const { DrawArchiveEngine } = await import('./lib/analytics/draw-archive.ts');",
            'runMigrations();',
            'const db = getDatabase();',
            "const insert = db.prepare('INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena, special_draw, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1000000, 1, ?, ?, ?)');",
            "insert.run(2810, '2024-12-31', 1, 17, 19, 29, 50, 57, 0, '2025-01-03 12:00:00', '2025-01-03 12:00:00');",
            "insert.run(3000, '2025-12-31', 2, 18, 20, 30, 51, 58, 1, '2026-01-02 09:00:00', '2026-02-01 10:00:00');",
            "insert.run(3010, '2026-05-24', 3, 30, 33, 35, 45, 47, 1, '2026-05-25 09:00:00', '2026-05-25 09:00:00');",
            "insert.run(3021, '2026-12-31', 4, 19, 21, 31, 52, 59, 1, '2027-01-03 09:00:00', '2027-01-03 09:00:00');",
            "insert.run(3025, '2027-01-01', 5, 20, 22, 32, 53, 60, 0, '2027-01-03 10:00:00', '2027-03-01 00:00:00');",
            "insert.run(3030, '2027-01-02', 6, 21, 23, 33, 54, 59, 1, '2027-01-05 08:00:00', '2027-01-05 08:00:00');",
            'const engine = new DrawArchiveEngine();',
            'const hub = engine.getMegaDaVirada();',
            'const editionOf = (contest) => engine.getDrawPage(contest).megaDaViradaEdition;',
            "console.log('RESULT:' + JSON.stringify({",
            '  editions: hub.editions.map((item) => [item.edition, item.draw.contestNumber]),',
            '  lastModified: hub.lastModified,',
            '  drawPages: Object.fromEntries([2810, 3000, 3010, 3021, 3025, 3030].map((c) => [c, editionOf(c)])),',
            '  sitemap: engine.getSitemapData().megaDaViradaLastModified,',
            '}));',
            'closeDatabase();',
          ].join(' '),
        ],
        {
          env: {
            ...process.env,
            DATABASE_PATH: dbPath,
            VITEST: '',
            VITEST_FORCE_FILE_DB: '1',
          },
          encoding: 'utf8',
        }
      );

      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);
      const resultLine = run.stdout.split('\n').find((line) => line.startsWith('RESULT:'));
      expect(resultLine).toBeTruthy();

      expect(JSON.parse(resultLine!.slice('RESULT:'.length))).toEqual({
        editions: [
          [2026, 3030],
          [2025, 3000],
          [2024, 2810],
        ],
        // 3025 was corrected later, but it is not an edition.
        lastModified: '2027-01-05T08:00:00.000Z',
        drawPages: { 2810: 2024, 3000: 2025, 3010: null, 3021: null, 3025: null, 3030: 2026 },
        sitemap: '2027-01-05T08:00:00.000Z',
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
