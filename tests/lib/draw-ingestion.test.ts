// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import seed from '@/db/seed/draws.json';
import { closeDatabase, getDatabase } from '@/lib/db';
import { CaixaAPIClient } from '@/lib/api/caixa-client';
import { DrawSourceFailure, importSeedDraws, refreshDraws } from '@/cloudflare/ingestion';

/**
 * Characterisation of the draw write paths: the Worker ingestion core (seed
 * bootstrap and CAIXA refresh) and the Bun CLIs that store draws. Each case
 * pins the stored row, or a rejection that writes nothing. Error wording is
 * deliberately not asserted.
 */

// Adapter: the only place that names the ingestion module's API.
const importSeed = (input: unknown): number => importSeedDraws(getDatabase(), input);
const refresh = () => refreshDraws(getDatabase(), new CaixaAPIClient({ maxRetries: 1 }));

const REPO = process.cwd();
const COLUMNS = `contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6,
  prize_sena, winners_sena, prize_quina, winners_quina, prize_quadra, winners_quadra,
  total_collection, accumulated, accumulated_value, next_estimated_prize, special_draw`;

type Row = Record<string, number | string | null>;
interface SeedDraw {
  contest: number; date: string; numbers: number[];
  prizeSena: number | null; winnersSena: number; prizeQuina: number | null; winnersQuina: number;
  prizeQuadra: number | null; winnersQuadra: number; totalCollection: number | null;
  accumulated: boolean; accumulatedValue: number | null; nextEstimatedPrize: number | null; specialDraw: boolean;
}

function storedRows(): Row[] {
  return getDatabase().prepare(`SELECT ${COLUMNS} FROM draws ORDER BY contest_number`).all() as Row[];
}

function asSeed(row: Row): SeedDraw {
  return {
    contest: row['contest_number'] as number,
    date: row['draw_date'] as string,
    numbers: [1, 2, 3, 4, 5, 6].map(index => row[`number_${index}`] as number),
    prizeSena: row['prize_sena'] as number | null,
    winnersSena: row['winners_sena'] as number,
    prizeQuina: row['prize_quina'] as number | null,
    winnersQuina: row['winners_quina'] as number,
    prizeQuadra: row['prize_quadra'] as number | null,
    winnersQuadra: row['winners_quadra'] as number,
    totalCollection: row['total_collection'] as number | null,
    accumulated: row['accumulated'] === 1,
    accumulatedValue: row['accumulated_value'] as number | null,
    nextEstimatedPrize: row['next_estimated_prize'] as number | null,
    specialDraw: row['special_draw'] === 1,
  };
}

const drawsRevision = () =>
  (getDatabase().prepare("SELECT revision FROM cache_revisions WHERE name = 'draws'").get() as { revision: number }).revision;

/** Contest 1 as stored when the payload carries no prize data. */
function row(overrides: Row = {}): Row {
  return {
    contest_number: 1, draw_date: '1996-03-11',
    number_1: 4, number_2: 5, number_3: 30, number_4: 33, number_5: 41, number_6: 52,
    prize_sena: 0, winners_sena: 0, prize_quina: 0, winners_quina: 0, prize_quadra: 0, winners_quadra: 0,
    total_collection: 0, accumulated: 0, accumulated_value: 0, next_estimated_prize: 0, special_draw: 0,
    ...overrides,
  };
}

const BASE = { numero: 1, dataApuracao: '11/03/1996', listaDezenas: ['41', '05', '04', '52', '30', '33'] };
const tiers = { listaRateioPremio: [
  { descricaoFaixa: '6 acertos', faixa: 1, numeroDeGanhadores: 3, valorPremio: 34856052.53 },
  { descricaoFaixa: '5 acertos', faixa: 2, numeroDeGanhadores: 96, valorPremio: 34815.62 },
  { descricaoFaixa: '4 acertos', faixa: 3, numeroDeGanhadores: 4494, valorPremio: 1225.92 },
] };
const tierRow = { prize_sena: 34856052.53, winners_sena: 3, prize_quina: 34815.62, winners_quina: 96, prize_quadra: 1225.92, winners_quadra: 4494 };

type Outcome = Row | 'rejected';
interface PayloadCase { name: string; payload: Record<string, unknown>; worker: Outcome; pull: Outcome }

/** CAIXA payloads, each with what the Worker refresh and `db:pull` store today. */
const CORPUS: PayloadCase[] = [
  {
    name: 'current shape with listaRateioPremio and valorAcumuladoProximoConcurso',
    payload: { ...BASE, ...tiers, valorArrecadado: 126007547.5, valorAcumuladoProximoConcurso: 12540698.04,
      valorEstimadoProximoConcurso: 3500000, acumulado: false, tipoJogo: 'MEGA_SENA', indicadorConcursoEspecial: 1 },
    worker: row({ ...tierRow, total_collection: 126007547.5, accumulated_value: 12540698.04, next_estimated_prize: 3500000 }),
    pull: row({ ...tierRow, total_collection: 126007547.5, accumulated_value: 12540698.04, next_estimated_prize: 3500000 }),
  },
  {
    name: 'legacy rateioProcessamento',
    payload: { ...BASE, acumulado: true, valorAcumuladoConcurso: 5000000, rateioProcessamento: [
      { descricaoFaixa: 'Sena', numeroDeGanhadores: 0, valorPremio: 0 },
      { descricaoFaixa: 'Quina', numeroDeGanhadores: 50, valorPremio: 40000.5 },
      { descricaoFaixa: 'Quadra', numeroDeGanhadores: 3000, valorPremio: 900.25 },
    ] },
    worker: row({ prize_quina: 40000.5, winners_quina: 50, prize_quadra: 900.25, winners_quadra: 3000, accumulated: 1, accumulated_value: 5000000 }),
    pull: row({ prize_quina: 40000.5, winners_quina: 50, prize_quadra: 900.25, winners_quadra: 3000, accumulated: 1, accumulated_value: 5000000 }),
  },
  {
    name: 'an empty rateioProcessamento falls back to listaRateioPremio',
    payload: { ...BASE, rateioProcessamento: [], listaRateioPremio: [{ faixa: 2, numeroDeGanhadores: 82, valorPremio: 24039.44 }] },
    worker: row({ prize_quina: 24039.44, winners_quina: 82 }),
    pull: row({ prize_quina: 24039.44, winners_quina: 82 }),
  },
  {
    name: 'a non-empty rateioProcessamento wins over listaRateioPremio',
    payload: { ...BASE, rateioProcessamento: [{ descricaoFaixa: 'Quina', numeroDeGanhadores: 10, valorPremio: 100 }],
      listaRateioPremio: [{ faixa: 2, numeroDeGanhadores: 82, valorPremio: 24039.44 }] },
    worker: row({ prize_quina: 100, winners_quina: 10 }),
    pull: row({ prize_quina: 100, winners_quina: 10 }),
  },
  {
    name: 'the first matching tier wins',
    payload: { ...BASE, listaRateioPremio: [{ faixa: 2, numeroDeGanhadores: 1, valorPremio: 111 }, { faixa: 2, numeroDeGanhadores: 2, valorPremio: 222 }] },
    worker: row({ prize_quina: 111, winners_quina: 1 }),
    pull: row({ prize_quina: 111, winners_quina: 1 }),
  },
  {
    name: 'fractional winners in a shadowed duplicate tier',
    payload: { ...BASE, listaRateioPremio: [{ faixa: 2, numeroDeGanhadores: 1, valorPremio: 111 }, { faixa: 2, numeroDeGanhadores: 2.5, valorPremio: 222 }] },
    worker: row({ prize_quina: 111, winners_quina: 1 }),
    pull: row({ prize_quina: 111, winners_quina: 1 }),
  },
  {
    name: 'fractional winners in an unmapped tier',
    payload: { ...BASE, listaRateioPremio: [{ faixa: 4, numeroDeGanhadores: 1.5, valorPremio: 10 }] },
    worker: row(),
    pull: row(),
  },
  {
    name: 'a malformed unused tier array',
    payload: { ...BASE, rateioProcessamento: [{ descricaoFaixa: 'Quina', numeroDeGanhadores: 10, valorPremio: 100 }], listaRateioPremio: 'garbage' },
    worker: 'rejected',
    pull: 'rejected',
  },
  {
    name: 'a negative prize in an unused tier array',
    payload: { ...BASE, rateioProcessamento: [{ descricaoFaixa: 'Quina', numeroDeGanhadores: 10, valorPremio: 100 }],
      listaRateioPremio: [{ faixa: 2, numeroDeGanhadores: 1, valorPremio: -1 }] },
    worker: 'rejected',
    pull: 'rejected',
  },
  { name: 'valorArrecadado as a string', payload: { ...BASE, valorArrecadado: '123' }, worker: row(), pull: row() },
  { name: 'valorArrecadado as null', payload: { ...BASE, valorArrecadado: null }, worker: row(), pull: row() },
  { name: 'a negative valorArrecadado', payload: { ...BASE, valorArrecadado: -1 }, worker: 'rejected', pull: row({ total_collection: -1 }) },
  { name: 'valorEstimadoProximoConcurso as a string', payload: { ...BASE, valorEstimadoProximoConcurso: '5' }, worker: row(), pull: row() },
  { name: 'a negative valorEstimadoProximoConcurso', payload: { ...BASE, valorEstimadoProximoConcurso: -1 }, worker: 'rejected', pull: row({ next_estimated_prize: -1 }) },
  { name: 'valorAcumuladoConcurso as a string', payload: { ...BASE, valorAcumuladoConcurso: '5' }, worker: 'rejected', pull: row({ accumulated_value: 5 }) },
  {
    name: 'a null valorAcumuladoConcurso falls back to valorAcumuladoProximoConcurso',
    payload: { ...BASE, valorAcumuladoConcurso: null, valorAcumuladoProximoConcurso: 77 },
    worker: row({ accumulated_value: 77 }),
    pull: row({ accumulated_value: 77 }),
  },
  {
    name: 'valorAcumuladoConcurso wins over valorAcumuladoProximoConcurso',
    payload: { ...BASE, valorAcumuladoConcurso: 88, valorAcumuladoProximoConcurso: 77 },
    worker: row({ accumulated_value: 88 }),
    pull: row({ accumulated_value: 88 }),
  },
  { name: 'special indicator 2', payload: { ...BASE, indicadorConcursoEspecial: 2 }, worker: row({ special_draw: 1 }), pull: row({ special_draw: 1 }) },
  { name: 'special indicator 1', payload: { ...BASE, indicadorConcursoEspecial: 1 }, worker: row(), pull: row() },
  { name: 'special indicator absent', payload: { ...BASE }, worker: row(), pull: row() },
  { name: 'a non-boolean acumulado', payload: { ...BASE, acumulado: 'yes' }, worker: row(), pull: row() },
  {
    name: 'fractional winners in a mapped tier',
    payload: { ...BASE, listaRateioPremio: [{ faixa: 1, numeroDeGanhadores: 1.5, valorPremio: 10 }] },
    worker: 'rejected',
    pull: row({ prize_sena: 10, winners_sena: 1.5 }),
  },
  { name: 'an impossible calendar date', payload: { ...BASE, dataApuracao: '31/02/2026' }, worker: 'rejected', pull: 'rejected' },
  { name: 'an ISO date', payload: { ...BASE, dataApuracao: '1996-03-11' }, worker: row(), pull: row() },
  { name: 'numeric dezenas', payload: { ...BASE, listaDezenas: [41, 5, 4, 52, 30, 33] }, worker: row(), pull: row() },
];

function seedDraw(contest: number, overrides: Partial<SeedDraw> = {}): SeedDraw {
  return {
    contest, date: `2026-05-${String(contest).padStart(2, '0')}`, numbers: [4, 5, 30, 33, 41, 52],
    prizeSena: 0, winnersSena: 0, prizeQuina: 40000, winnersQuina: 50, prizeQuadra: 900, winnersQuadra: 3000,
    totalCollection: 40000000, accumulated: true, accumulatedValue: 5000000, nextEstimatedPrize: 10000000,
    specialDraw: false, ...overrides,
  };
}

beforeEach(() => {
  closeDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Worker ingestion core', () => {
  it('imports the public seed into an empty database exactly as published', () => {
    expect(importSeed(seed)).toBe(3065);
    expect(storedRows().map(asSeed)).toEqual(seed);
    const frequency = getDatabase().prepare('SELECT SUM(frequency) AS total FROM number_frequency').get() as { total: number };
    const pairs = getDatabase().prepare('SELECT COUNT(*) AS total FROM number_pair_frequency').get() as { total: number };
    expect(frequency.total).toBe(18390);
    expect(pairs.total).toBe(1770);
    const revision = drawsRevision();
    expect(importSeed(seed)).toBe(0);
    expect(drawsRevision()).toBe(revision);
  }, 60_000);

  it.each(CORPUS.map(entry => [entry.name, entry] as const))('refresh with %s', async (_name, entry) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(entry.payload)));
    if (entry.worker === 'rejected') {
      await expect(refresh()).rejects.toBeInstanceOf(DrawSourceFailure);
      expect(storedRows()).toEqual([]);
    } else {
      await expect(refresh()).resolves.toMatchObject({ status: 'success', inserted: 1 });
      expect(storedRows()).toEqual([entry.worker]);
    }
  });

  it('stores a null seed prize as NULL', () => {
    expect(importSeed([seedDraw(1, { prizeSena: null })])).toBe(1);
    expect(storedRows()[0]?.['prize_sena']).toBeNull();
  });

  it('accepts a DD/MM/YYYY seed date and stores it as ISO', () => {
    expect(importSeed([seedDraw(1, { date: '01/05/2026' })])).toBe(1);
    expect(storedRows()[0]?.['draw_date']).toBe('2026-05-01');
  });

  it('stores unsorted seed numbers in ascending order', () => {
    expect(importSeed([seedDraw(1, { numbers: [52, 41, 33, 30, 5, 4] })])).toBe(1);
    expect(asSeed(storedRows()[0]!).numbers).toEqual([4, 5, 30, 33, 41, 52]);
  });

  it('refuses a seed archive that does not start at contest 1', () => {
    expect(() => importSeed([seedDraw(2), seedDraw(3)])).toThrow();
    expect(storedRows()).toEqual([]);
  });
});

describe('Bun CLIs that store draws', () => {
  let directory: string;
  let template: string;

  const bun = (args: string[], database: string, extra: Record<string, string> = {}) =>
    spawnSync('bun', args, {
      cwd: REPO,
      env: { ...process.env, DATABASE_PATH: database, VITEST: '', VITEST_FORCE_FILE_DB: '1', NODE_ENV: 'test', ...extra },
      encoding: 'utf8',
      timeout: 60_000,
    });

  function freshDatabase(name: string): string {
    const file = path.join(directory, `${name}.db`);
    fs.copyFileSync(template, file);
    return file;
  }

  function readRows(file: string): Row[] {
    const database = new DatabaseSync(file, { readOnly: true });
    try {
      return database.prepare(`SELECT ${COLUMNS} FROM draws ORDER BY contest_number`).all() as Row[];
    } finally {
      database.close();
    }
  }

  function importDraws(file: string, draws: unknown, ...flags: string[]) {
    const input = path.join(directory, `input-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(input, JSON.stringify(draws));
    return bun(['run', 'scripts/import-draws.ts', input, ...flags], file);
  }

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'megasena-ingestion-'));
    template = path.join(directory, 'template.db');
    const migrated = bun(['-e', "import { runMigrations, closeDatabase } from './lib/db.ts'; runMigrations(); closeDatabase();"], template);
    expect(migrated.status, migrated.stderr).toBe(0);
    fs.writeFileSync(path.join(directory, 'caixa.ts'),
      'globalThis.fetch = async () => Response.json(JSON.parse(process.env.CORPUS_PAYLOAD ?? "{}"));\n');
  }, 60_000);

  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('import-draws stores the full public seed into an empty database exactly as published', () => {
    const file = freshDatabase('full-seed');
    const result = bun(['run', 'scripts/import-draws.ts', 'db/seed/draws.json'], file);
    expect(result.status, result.stderr).toBe(0);
    expect(readRows(file).map(asSeed)).toEqual(seed);
  }, 60_000);

  it.each(CORPUS.map((entry, index) => [entry.name, entry, index] as const))('pull-draws with %s', (_name, entry, index) => {
    const file = freshDatabase(`pull-${index}`);
    const result = bun(['--preload', path.join(directory, 'caixa.ts'), 'scripts/pull-draws.ts', '--limit', '1'], file,
      { CORPUS_PAYLOAD: JSON.stringify(entry.payload) });
    if (entry.pull === 'rejected') {
      expect(result.status, result.stdout + result.stderr).toBe(1);
      expect(readRows(file)).toEqual([]);
    } else {
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(readRows(file)).toEqual([entry.pull]);
    }
  }, 30_000);

  it('import-draws stores a null seed prize as 0', () => {
    const file = freshDatabase('null-prize');
    const result = importDraws(file, [seedDraw(1, { prizeSena: null })]);
    expect(result.status, result.stderr).toBe(0);
    expect(readRows(file)[0]?.['prize_sena']).toBe(0);
  }, 30_000);

  it('import-draws refuses a DD/MM/YYYY seed date', () => {
    const file = freshDatabase('dd-mm');
    const result = importDraws(file, [seedDraw(1, { date: '01/05/2026' })]);
    expect(result.status).toBe(1);
    expect(readRows(file)).toEqual([]);
  }, 30_000);

  it('import-draws stores unsorted seed numbers in ascending order', () => {
    const file = freshDatabase('unsorted');
    const result = importDraws(file, [seedDraw(1, { numbers: [52, 41, 33, 30, 5, 4] })]);
    expect(result.status, result.stderr).toBe(0);
    expect(asSeed(readRows(file)[0]!).numbers).toEqual([4, 5, 30, 33, 41, 52]);
  }, 30_000);

  it.each([[[]], [['--dry-run']]])('import-draws accepts an archive that does not start at contest 1 (flags %j)', (flags) => {
    const file = freshDatabase(`offset-${flags.length}`);
    const result = importDraws(file, [seedDraw(2), seedDraw(3)], ...flags);
    expect(result.status, result.stderr).toBe(0);
    expect(readRows(file).map(entry => entry['contest_number'])).toEqual(flags.length ? [] : [2, 3]);
  }, 30_000);
});
