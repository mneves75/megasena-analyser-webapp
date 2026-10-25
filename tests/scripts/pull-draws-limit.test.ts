import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// `db:pull -- --incremental --limit N` is the documented routine refresh. When
// more than N contests were published since the last run, the latest-N window
// does not reach the stored archive and must be refused instead of written.
describe('pull-draws --limit', () => {
  it.each([
    { stored: 2, expectedStatus: 1, expectedContests: [1, 2] },
    { stored: 0, expectedStatus: 0, expectedContests: [8, 9, 10] },
  ])('keeps the archive contiguous (stored through $stored)', ({ stored, expectedStatus, expectedContests }) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'megasena-pull-limit-'));
    const env = { ...process.env, DATABASE_PATH: path.join(directory, 'archive.db'), VITEST: '', VITEST_FORCE_FILE_DB: '1' };
    const run = (args: string[]) => spawnSync('bun', args, { cwd: process.cwd(), env, encoding: 'utf8', timeout: 20000 });
    try {
      const seeded = run(['-e', `
        import { runMigrations, getDatabase, closeDatabase } from './lib/db.ts';
        runMigrations();
        for (let contest = 1; contest <= ${stored}; contest++) {
          getDatabase().prepare("INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6) VALUES (?, '2026-09-0' || ?, 1, 2, 3, 4, 5, 6)").run(contest, contest);
        }
        closeDatabase();
      `]);
      expect(seeded.status, seeded.stderr).toBe(0);
      const preload = path.join(directory, 'fixture.ts');
      fs.writeFileSync(preload, `
        globalThis.fetch = async (url) => {
          const numero = Number(String(url).split('/').at(-1)) || 10;
          return Response.json({ numero, dataApuracao: String(numero).padStart(2, '0') + '/09/2026',
            listaDezenas: ['10', '20', '30', '40', '50', '60'], acumulado: false, listaRateioPremio: [] });
        };
      `);
      const result = run(['--preload', preload, 'scripts/pull-draws.ts', '--incremental', '--limit', '3']);
      expect(result.status, result.stdout + result.stderr).toBe(expectedStatus);
      const inspected = run(['-e', `
        import { Database } from 'bun:sqlite';
        const db = new Database(process.env.DATABASE_PATH, { readonly: true });
        console.log(JSON.stringify(db.query('SELECT contest_number FROM draws ORDER BY contest_number').all().map(row => row.contest_number)));
      `]);
      expect(inspected.status, inspected.stderr).toBe(0);
      expect(JSON.parse(inspected.stdout.trim())).toEqual(expectedContests);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
