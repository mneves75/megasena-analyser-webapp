import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatisticsEngine } from '@/lib/analytics/statistics';
import { closeDatabase, getDatabase } from '@/lib/db';
import seed from '@/db/seed/draws.json';

type Database = ReturnType<typeof getDatabase>;
type Row = { number: number; frequency: number; last_drawn_contest: number | null; last_drawn_date: string | null };

/** The pre-aggregate implementation (720 queries), kept only as the oracle. */
function oracleRebuild(db: Database): void {
  db.prepare('UPDATE number_frequency SET frequency = 0').run();
  const update = db.prepare(`UPDATE number_frequency SET frequency = ?, last_drawn_contest = ?,
    last_drawn_date = ?, updated_at = CURRENT_TIMESTAMP WHERE number = ?`);
  for (let num = 1; num <= 60; num++) {
    let frequency = 0;
    let lastContest: number | null = null;
    let lastDate: string | null = null;
    for (let col = 1; col <= 6; col++) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM draws WHERE number_${col} = ?`).get(num) as { count: number };
      frequency += count.count;
      const last = db.prepare(`SELECT contest_number, draw_date FROM draws WHERE number_${col} = ?
        ORDER BY contest_number DESC LIMIT 1`).get(num) as { contest_number: number; draw_date: string } | undefined;
      if (last && (lastContest === null || last.contest_number > lastContest)) {
        lastContest = last.contest_number;
        lastDate = last.draw_date;
      }
    }
    update.run(frequency, lastContest, lastDate, num);
  }
}

const snapshot = (db: Database): Row[] => db.prepare(
  'SELECT number, frequency, last_drawn_contest, last_drawn_date FROM number_frequency ORDER BY number'
).all() as Row[];

const corrupt = (db: Database): void => {
  db.prepare("UPDATE number_frequency SET frequency = 999, last_drawn_contest = 1, last_drawn_date = 'stale'").run();
};

function insertDraws(db: Database, draws: Array<{ contest: number; date: string; numbers: number[] }>): void {
  const insert = db.prepare(`INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3,
    number_4, number_5, number_6) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  for (const draw of draws) insert.run(draw.contest, draw.date, ...draw.numbers);
  db.exec('COMMIT');
}

/** Same rows as the oracle, starting each run from stale cache values. */
function expectMatchesOracle(db: Database): Row[] {
  corrupt(db);
  oracleRebuild(db);
  const expected = snapshot(db);
  corrupt(db);
  new StatisticsEngine().updateNumberFrequencies();
  expect(snapshot(db)).toStrictEqual(expected);
  return expected;
}

describe('number_frequency rebuild', () => {
  afterEach(() => vi.restoreAllMocks());

  it('matches the per-column implementation on the full public seed', () => {
    closeDatabase();
    const db = getDatabase();
    insertDraws(db, seed);
    const rows = expectMatchesOracle(db);
    expect(rows).toHaveLength(60);
    expect(rows.reduce((sum, row) => sum + row.frequency, 0)).toBe(seed.length * 6);
  });

  it('matches the per-column implementation when a number was never drawn', () => {
    closeDatabase();
    const db = getDatabase();
    insertDraws(db, [
      { contest: 1, date: '2025-01-01', numbers: [1, 2, 3, 4, 5, 6] },
      { contest: 2, date: '2025-01-08', numbers: [6, 1, 7, 8, 9, 10] },
    ]);
    const rows = expectMatchesOracle(db);
    expect({ ...rows.find(row => row.number === 60) }).toStrictEqual({
      number: 60, frequency: 0, last_drawn_contest: null, last_drawn_date: null,
    });
  });

  it('reads the draws with a single aggregate query', () => {
    closeDatabase();
    const db = getDatabase();
    insertDraws(db, seed.slice(0, 50));
    let reads = 0;
    const prepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const statement = prepare(sql);
      const get = statement.get.bind(statement);
      const all = statement.all.bind(statement);
      statement.get = ((...args: Parameters<typeof get>) => { reads++; return get(...args); }) as typeof statement.get;
      statement.all = ((...args: Parameters<typeof all>) => { reads++; return all(...args); }) as typeof statement.all;
      return statement;
    });
    new StatisticsEngine().updateNumberFrequencies();
    expect(reads).toBe(1);
  });
});
