import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Failure modes: writing the default DB instead of DATABASE_PATH, dropping the
// special flag, stale derived caches, or committing part of an invalid batch.
describe('fetch-missing CLI', () => {
  it.each([false, true])('uses the configured DB and commits atomically (invalid batch: %s)', (invalid) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'megasena-fetch-'));
    const dbFile = path.join(directory, 'configured.db');
    const defaultFile = path.join(directory, 'db/mega-sena.db');
    const env = { ...process.env, DATABASE_PATH: dbFile, VITEST: '', VITEST_FORCE_FILE_DB: '1' };
    const run = (args: string[]) => spawnSync('bun', args, { cwd: process.cwd(), env, encoding: 'utf8', timeout: 15000 });
    try {
      const seeded = run(['-e', `
        import { runMigrations, getDatabase, closeDatabase } from './lib/db.ts';
        runMigrations();
        getDatabase().exec("INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6) VALUES (1, '2026-09-01', 1, 2, 3, 4, 5, 6)");
        closeDatabase();
      `]);
      expect(seeded.status, seeded.stderr).toBe(0);
      fs.mkdirSync(path.dirname(defaultFile));
      fs.copyFileSync(dbFile, defaultFile);
      fs.cpSync(path.join(process.cwd(), 'db/migrations'), path.join(directory, 'db/migrations'), { recursive: true });
      const preload = path.join(directory, 'fixture.ts');
      fs.writeFileSync(preload, `
        process.chdir(${JSON.stringify(directory)});
        globalThis.fetch = async (url) => {
          const numero = Number(String(url).split('/').at(-1)) || 3;
          return Response.json({ numero, dataApuracao: '0' + numero + '/09/2026',
            listaDezenas: ${invalid ? "numero === 3 ? ['1','1','3','4','5','6'] : " : ''}['10','20','30','40','50','60'],
            acumulado: true, indicadorConcursoEspecial: 2,
            listaRateioPremio: [{ faixa: 2, valorPremio: 123, numeroDeGanhadores: 2 }] });
        };
      `);
      const result = run(['--preload', preload, path.join(process.cwd(), 'scripts/fetch-missing.ts')]);
      const inspected = run(['-e', `
        import { Database } from 'bun:sqlite';
        const target = new Database(process.env.DATABASE_PATH, { readonly: true });
        const other = new Database(${JSON.stringify(defaultFile)});
        console.log(JSON.stringify({
          count: target.query('SELECT COUNT(*) n FROM draws').get().n,
          defaults: other.query('SELECT COUNT(*) n FROM draws').get().n,
          special: target.query('SELECT special_draw, prize_quina FROM draws WHERE contest_number = 2').get(),
          frequencies: target.query('SELECT SUM(frequency) n FROM number_frequency').get().n,
          pairs: target.query('SELECT SUM(frequency) n FROM number_pair_frequency').get().n
        }));
      `]);
      expect(inspected.status, inspected.stderr).toBe(0);
      const state = JSON.parse(inspected.stdout.trim());
      expect(state.defaults).toBe(1);
      if (invalid) {
        expect(result.status).toBe(1);
        expect(state.count).toBe(1);
      } else {
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(state.count).toBe(3);
        expect(state.special).toEqual({ special_draw: 1, prize_quina: 123 });
        expect(state.frequencies).toBe(18);
        expect(state.pairs).toBe(45);
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
