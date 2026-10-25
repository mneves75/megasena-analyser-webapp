import { beforeAll, describe, expect, it } from 'vitest';
import { DrawArchiveEngine } from '@/lib/analytics/draw-archive';
import { closeDatabase, getDatabase } from '@/lib/db';

// Load times are explicit: lastmod semantics are the contract under test.
const DRAWS = [
  { contest: 1, date: '2024-12-28', numbers: [1, 2, 3, 4, 5, 6], created: '2024-12-29 10:00:00' },
  { contest: 2, date: '2024-12-31', numbers: [11, 10, 9, 8, 7, 1], created: '2025-01-02 10:00:00' },
  { contest: 3, date: '2025-01-04', numbers: [2, 7, 12, 13, 14, 15], created: '2025-01-05 10:00:00' },
  // Corrected long after the next draw was loaded (a prize backfill, for example).
  { contest: 4, date: '2025-01-08', numbers: [1, 2, 3, 20, 21, 22], created: '2025-01-09 10:00:00', updated: '2025-03-01 12:00:00' },
  { contest: 5, date: '2025-01-11', numbers: [30, 31, 32, 33, 34, 35], created: '2025-01-12 10:00:00' },
];

describe('DrawArchiveEngine on real SQLite', () => {
  let archive: DrawArchiveEngine;

  beforeAll(() => {
    closeDatabase();
    const insert = getDatabase().prepare(`INSERT INTO draws (contest_number, draw_date,
      number_1, number_2, number_3, number_4, number_5, number_6, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const draw of DRAWS) {
      insert.run(draw.contest, draw.date, ...draw.numbers, draw.created, draw.updated ?? draw.created);
    }
    archive = new DrawArchiveEngine();
  });

  it('links each draw page to its neighbours and computes history only up to that draw', () => {
    const page = archive.getDrawPage(3)!;
    expect(page.draw.numbers).toEqual([2, 7, 12, 13, 14, 15]);
    expect(page.previous).toEqual({ contestNumber: 2, numbers: [1, 7, 8, 9, 10, 11] });
    expect(page.next).toEqual({ contestNumber: 4, drawDate: '2025-01-08' });
    expect(page.numberHistory.slice(0, 3)).toEqual([
      { number: 2, timesDrawn: 2, previous: { contestNumber: 1, drawDate: '2024-12-28', drawsBetween: 1 } },
      { number: 7, timesDrawn: 2, previous: { contestNumber: 2, drawDate: '2024-12-31', drawsBetween: 0 } },
      { number: 12, timesDrawn: 1, previous: null },
    ]);
    expect(page.sumContext).toEqual({ earlierDraws: 2, lowerSum: 2 });
    expect(archive.getDrawPage(1)!.previous).toBeNull();
    expect(archive.getDrawPage(5)!.next).toBeNull();
    expect(archive.getDrawPage(99)).toBeNull();
  });

  it('dates a draw page by its own history and by the next draw that links back to it', () => {
    const lastModified = DRAWS.map(draw => archive.getDrawPage(draw.contest)!.lastModified);
    expect(lastModified).toEqual([
      '2025-01-02T10:00:00.000Z', // "Próximo concurso" appeared when contest 2 loaded
      '2025-01-05T10:00:00.000Z',
      '2025-01-09T10:00:00.000Z',
      '2025-03-01T12:00:00.000Z', // its own correction
      '2025-03-01T12:00:00.000Z', // history embeds the corrected earlier draw
    ]);
  });

  it('lists a year newest first and dates it by its rows plus the next year link', () => {
    const year2024 = archive.getYearArchive(2024)!;
    expect(year2024.draws.map(draw => draw.contestNumber)).toEqual([2, 1]);
    expect(year2024).toMatchObject({ previousYear: null, nextYear: 2025 });
    // The first 2025 load added the "Próximo ano" link to the 2024 page.
    expect(year2024.lastModified).toBe('2025-01-05T10:00:00.000Z');
    const year2025 = archive.getYearArchive(2025)!;
    expect(year2025.draws.map(draw => draw.contestNumber)).toEqual([5, 4, 3]);
    expect(year2025).toMatchObject({ previousYear: 2024, nextYear: null, lastModified: '2025-03-01T12:00:00.000Z' });
    expect(archive.getYearArchive(2023)).toBeNull();
  });

  it('feeds the sitemap the same dates the pages report', () => {
    const sitemap = archive.getSitemapData();
    expect(sitemap.archive).toMatchObject({ totalDraws: 5, lastContestNumber: 5, lastDrawDate: '2025-01-11',
      lastModified: '2025-03-01T12:00:00.000Z' });
    expect(sitemap.draws).toEqual(DRAWS.map(draw => ({
      contestNumber: draw.contest, lastModified: archive.getDrawPage(draw.contest)!.lastModified,
    })));
    expect(sitemap.years).toEqual([
      { year: 2025, lastModified: '2025-03-01T12:00:00.000Z' },
      { year: 2024, lastModified: '2025-01-05T10:00:00.000Z' },
    ]);
    expect(sitemap.megaDaViradaLastModified).toBeNull();
  });

  it('profiles a number with gaps counted in draws and companions ranked by count', () => {
    const profile = archive.getNumberProfile(1);
    expect(profile).toMatchObject({ number: 1, frequency: 3, rank: 1, averageInterval: 1.5, longestGap: 1,
      lastAppearance: { contestNumber: 4, drawDate: '2025-01-08', drawsSince: 1 } });
    expect(profile.appearances.map(appearance => appearance.contestNumber)).toEqual([4, 2, 1]);
    expect(profile.companions.slice(0, 2)).toEqual([{ number: 2, count: 2 }, { number: 3, count: 2 }]);
  });
});
