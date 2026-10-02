import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Failure modes: holding a SQLite writer lock across network waits, partial
// writes after DB failure, losing fetched progress after sustained CAIXA failure.
describe('backfill-prizes CLI', () => {
  it('lets another connection write during CAIXA fetches and preserves progress', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'megasena-backfill-'));
    const database = path.join(directory, 'fixture.db');
    const env = { ...process.env, DATABASE_PATH: database, VITEST: '', VITEST_FORCE_FILE_DB: '1' };
    const run = (args: string[]) => spawnSync('bun', args, { cwd: process.cwd(), env, encoding: 'utf8', timeout: 15000 });
    try {
      const seeded = run(['-e', `
        import { runMigrations, getDatabase, closeDatabase } from './lib/db';
        runMigrations();
        for (let n = 1; n <= 2; n++) getDatabase().prepare(
          "INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6) VALUES (?, '2026-09-01', 1, 2, 3, 4, 5, 6)"
        ).run(n);
        closeDatabase();
      `]);
      expect(seeded.status, seeded.stderr).toBe(0);
      const preload = path.join(directory, 'network.ts');
      fs.writeFileSync(preload, `
        import { Database } from 'bun:sqlite';
        globalThis.fetch = async (url) => {
          const numero = Number(String(url).split('/').at(-1));
          const other = new Database(process.env.DATABASE_PATH);
          try {
            other.prepare("INSERT INTO log_events (id,timestamp,level,event) VALUES (?,datetime('now'),'info','backfill.concurrent')").run(String(numero));
          } finally { other.close(); }
          return Response.json({ numero, dataApuracao: '01/09/2026', listaDezenas: ['1','2','3','4','5','6'],
            listaRateioPremio: [{ faixa: 2, valorPremio: 123, numeroDeGanhadores: 2 }] });
        };
      `);
      const result = run(['--preload', preload, 'scripts/backfill-prizes.ts', '--delay', '1']);
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const inspected = run(['-e', `
        import { Database } from 'bun:sqlite';
        const db = new Database(process.env.DATABASE_PATH, { readonly: true });
        console.log(JSON.stringify({prizes: db.query('SELECT prize_quina FROM draws ORDER BY contest_number').all(), concurrent: db.query('SELECT count(*) n FROM log_events').get().n}));
        db.close();
      `]);
      expect(inspected.status, inspected.stderr).toBe(0);
      expect(JSON.parse(inspected.stdout)).toEqual({ prizes: [{prize_quina:123},{prize_quina:123}], concurrent:2 });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
