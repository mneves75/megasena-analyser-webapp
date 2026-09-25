import { getDatabase } from '@/lib/db';
import type {
  ArchiveIndex,
  ArchiveState,
  DrawNumberHistory,
  DrawPage,
  DrawRecord,
  NumberProfile,
  NumbersIndex,
  NumberSummary,
  SitemapData,
  YearArchive,
  YearSummary,
} from '@/lib/api/archive-contract';

/**
 * Read model for the public results archive: one draw, one year, one number,
 * and the indexes behind the sitemap. Everything is derived from `draws` (not
 * the `number_frequency` cache table) so every archive page agrees with the
 * draw pages it links to.
 */

const DRAW_COLUMNS = `
  contest_number, draw_date,
  number_1, number_2, number_3, number_4, number_5, number_6,
  prize_sena, winners_sena, prize_quina, winners_quina, prize_quadra, winners_quadra,
  total_collection, accumulated, accumulated_value, next_estimated_prize`;

const NUMBER_OCCURRENCES_CTE = `
  occurrences AS (
    SELECT contest_number, draw_date, number_1 AS number FROM draws
    UNION ALL SELECT contest_number, draw_date, number_2 FROM draws
    UNION ALL SELECT contest_number, draw_date, number_3 FROM draws
    UNION ALL SELECT contest_number, draw_date, number_4 FROM draws
    UNION ALL SELECT contest_number, draw_date, number_5 FROM draws
    UNION ALL SELECT contest_number, draw_date, number_6 FROM draws
  )`;

/**
 * When archive pages last changed, for sitemap lastmod and JSON-LD dateModified.
 * Timestamps are the rows' load times (`created_at`/`updated_at`, UTC): loads lag
 * draws by days, so draw dates alone would understate changes.
 *
 * - `page_modified` (a draw page): the page embeds history computed from every
 *   earlier draw, so it changes whenever any row up to and including it is
 *   loaded or corrected, and again when the next draw is loaded and adds the
 *   "Próximo concurso" link.
 * - `listing_modified` (a draw's row in a year list): its own row, plus the next
 *   load, which for a year's last draw is the "Próximo ano" link appearing.
 */
const DRAW_CHANGES_CTE = `
  draw_touches AS (
    SELECT contest_number, draw_date,
           MAX(COALESCE(updated_at, draw_date), COALESCE(created_at, draw_date)) AS touched,
           COALESCE(LEAD(COALESCE(created_at, draw_date)) OVER (ORDER BY contest_number), '') AS next_loaded
    FROM draws
  ),
  draw_changes AS (
    SELECT contest_number, draw_date,
           MAX(touched, next_loaded) AS listing_modified,
           MAX(
             MAX(touched) OVER (ORDER BY contest_number ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
             next_loaded
           ) AS page_modified
    FROM draw_touches
  )`;

const DRAWS_WITH_NUMBER = `?1 IN (number_1, number_2, number_3, number_4, number_5, number_6)`;

const APPEARANCES_SHOWN = 12;
const COMPANIONS_SHOWN = 6;
const RECENT_DRAWS_SHOWN = 10;

type NumberColumns = Record<`number_${1 | 2 | 3 | 4 | 5 | 6}`, number>;

interface DrawRow extends NumberColumns {
  contest_number: number;
  draw_date: string;
  prize_sena: number | null;
  winners_sena: number | null;
  prize_quina: number | null;
  winners_quina: number | null;
  prize_quadra: number | null;
  winners_quadra: number | null;
  total_collection: number | null;
  accumulated: number | boolean | null;
  accumulated_value: number | null;
  next_estimated_prize: number | null;
}

interface YearRow {
  year: number;
  draw_count: number;
  first_contest: number;
  last_contest: number;
  first_draw_date: string;
  last_draw_date: string;
}

function positiveOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** SQLite `CURRENT_TIMESTAMP` ("YYYY-MM-DD HH:MM:SS", UTC) or a bare date → ISO instant. */
function toIsoInstant(value: string | null | undefined): string | null {
  const match = value ? /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?/.exec(value) : null;
  if (!match) {
    return null;
  }
  const instant = new Date(`${match[1]}T${match[2] ?? '00:00:00'}Z`);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

function requireInstant(value: string | null | undefined, context: string): string {
  const instant = toIsoInstant(value);
  if (instant === null) {
    throw new Error(`Invalid archive timestamp for ${context}: ${String(value)}`);
  }
  return instant;
}

function sortedNumbers(row: NumberColumns): number[] {
  return [row.number_1, row.number_2, row.number_3, row.number_4, row.number_5, row.number_6].sort(
    (a, b) => a - b
  );
}

function toDrawRecord(row: DrawRow): DrawRecord {
  return {
    contestNumber: row.contest_number,
    drawDate: row.draw_date,
    numbers: sortedNumbers(row),
    sena: { winners: row.winners_sena ?? 0, prize: row.prize_sena ?? 0 },
    quina: { winners: row.winners_quina ?? 0, prize: row.prize_quina ?? 0 },
    quadra: { winners: row.winners_quadra ?? 0, prize: row.prize_quadra ?? 0 },
    accumulated: Boolean(row.accumulated),
    accumulatedValue: positiveOrNull(row.accumulated_value),
    nextEstimatedPrize: positiveOrNull(row.next_estimated_prize),
    totalCollection: positiveOrNull(row.total_collection),
  };
}

function toYearSummary(row: YearRow): YearSummary {
  return {
    year: row.year,
    drawCount: row.draw_count,
    firstContest: row.first_contest,
    lastContest: row.last_contest,
    firstDrawDate: row.first_draw_date,
    lastDrawDate: row.last_draw_date,
  };
}

export class DrawArchiveEngine {
  private readonly db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  getDrawPage(contest: number): DrawPage | null {
    const row = this.db
      .prepare(`SELECT ${DRAW_COLUMNS} FROM draws WHERE contest_number = ?`)
      .get(contest) as DrawRow | undefined;
    if (!row) {
      return null;
    }

    const previous = this.db
      .prepare(
        `SELECT contest_number, number_1, number_2, number_3, number_4, number_5, number_6
         FROM draws WHERE contest_number < ? ORDER BY contest_number DESC LIMIT 1`
      )
      .get(contest) as (NumberColumns & { contest_number: number }) | undefined;
    const next = this.db
      .prepare(
        `SELECT contest_number, draw_date FROM draws
         WHERE contest_number > ? ORDER BY contest_number ASC LIMIT 1`
      )
      .get(contest) as { contest_number: number; draw_date: string } | undefined;
    const change = this.db
      .prepare(
        `WITH ${DRAW_CHANGES_CTE} SELECT page_modified FROM draw_changes WHERE contest_number = ?`
      )
      .get(contest) as { page_modified: string };
    const draw = toDrawRecord(row);

    return {
      draw,
      lastModified: requireInstant(change.page_modified, `contest ${contest}`),
      previous: previous
        ? { contestNumber: previous.contest_number, numbers: sortedNumbers(previous) }
        : null,
      next: next ? { contestNumber: next.contest_number, drawDate: next.draw_date } : null,
      numberHistory: this.getNumberHistoryAt(contest, draw.numbers),
      sumContext: this.getSumContextAt(
        contest,
        draw.numbers.reduce((sum, number) => sum + number, 0)
      ),
    };
  }

  getArchiveIndex(): ArchiveIndex {
    const recentRows = this.db
      .prepare(`SELECT ${DRAW_COLUMNS} FROM draws ORDER BY contest_number DESC LIMIT ?`)
      .all(RECENT_DRAWS_SHOWN) as DrawRow[];

    return {
      archive: this.getArchiveState(),
      recent: recentRows.map(toDrawRecord),
      years: this.getYearSummaries(),
    };
  }

  getYearArchive(year: number): YearArchive | null {
    const range = [`${year}-01-01`, `${year + 1}-01-01`] as const;
    const rows = this.db
      .prepare(
        `SELECT ${DRAW_COLUMNS} FROM draws
         WHERE draw_date >= ? AND draw_date < ?
         ORDER BY contest_number DESC`
      )
      .all(...range) as DrawRow[];
    if (rows.length === 0) {
      return null;
    }

    const change = this.db
      .prepare(
        `WITH ${DRAW_CHANGES_CTE}
         SELECT MAX(listing_modified) AS last_modified FROM draw_changes
         WHERE draw_date >= ? AND draw_date < ?`
      )
      .get(...range) as { last_modified: string };
    // Summaries are ordered newest first.
    const years = this.getYearSummaries().map((summary) => summary.year);

    return {
      year,
      // The year's last listing already counts the load of the next year's
      // first draw, so this also covers the "Próximo ano" link appearing.
      lastModified: requireInstant(change.last_modified, `year ${year}`),
      draws: rows.map(toDrawRecord),
      previousYear: years.find((candidate) => candidate < year) ?? null,
      nextYear: years.filter((candidate) => candidate > year).at(-1) ?? null,
    };
  }

  getNumbersIndex(): NumbersIndex {
    const { archive, summaries } = this.computeNumberSummaries();
    return { archive, numbers: summaries };
  }

  getNumberProfile(number: number): NumberProfile {
    const { archive, summaries, drawIndexByContest } = this.computeNumberSummaries();
    const summary = summaries[number - 1];
    if (!summary) {
      throw new RangeError(`Number out of range: ${number}`);
    }

    const appearances = this.db
      .prepare(
        `SELECT contest_number, draw_date FROM draws
         WHERE ${DRAWS_WITH_NUMBER} ORDER BY contest_number ASC`
      )
      .all(number) as Array<{ contest_number: number; draw_date: string }>;

    // Positions in draw order (1-based), so gaps stay correct even when the
    // local archive is missing contests.
    const positions = appearances
      .map((appearance) => drawIndexByContest.get(appearance.contest_number))
      .filter((position): position is number => position !== undefined);

    let averageInterval: number | null = null;
    let longestGap: number | null = null;
    const firstPosition = positions[0];
    const lastPosition = positions.at(-1);
    if (firstPosition !== undefined && lastPosition !== undefined) {
      const intervals = positions
        .slice(1)
        .map((position, index) => position - (positions[index] ?? position));
      averageInterval =
        intervals.length > 0
          ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
          : null;
      longestGap = Math.max(
        firstPosition - 1,
        archive.totalDraws - lastPosition,
        ...intervals.map((interval) => interval - 1)
      );
    }

    const companions = this.db
      .prepare(
        `WITH hits AS (
           SELECT number_1, number_2, number_3, number_4, number_5, number_6
           FROM draws WHERE ${DRAWS_WITH_NUMBER}
         ),
         companions AS (
           SELECT number_1 AS number FROM hits
           UNION ALL SELECT number_2 FROM hits
           UNION ALL SELECT number_3 FROM hits
           UNION ALL SELECT number_4 FROM hits
           UNION ALL SELECT number_5 FROM hits
           UNION ALL SELECT number_6 FROM hits
         )
         SELECT number, COUNT(*) AS count FROM companions
         WHERE number != ?1
         GROUP BY number
         ORDER BY count DESC, number ASC
         LIMIT ${COMPANIONS_SHOWN}`
      )
      .all(number) as Array<{ number: number; count: number }>;

    return {
      ...summary,
      archive,
      averageInterval,
      longestGap,
      appearances: appearances
        .slice(-APPEARANCES_SHOWN)
        .reverse()
        .map((appearance) => ({
          contestNumber: appearance.contest_number,
          drawDate: appearance.draw_date,
        })),
      companions,
    };
  }

  getSitemapData(): SitemapData {
    const draws = this.db
      .prepare(
        `WITH ${DRAW_CHANGES_CTE}
         SELECT contest_number, page_modified AS last_modified FROM draw_changes
         ORDER BY contest_number ASC`
      )
      .all() as Array<{ contest_number: number; last_modified: string }>;
    const years = this.db
      .prepare(
        `WITH ${DRAW_CHANGES_CTE}
         SELECT CAST(substr(draw_date, 1, 4) AS INTEGER) AS year, MAX(listing_modified) AS last_modified
         FROM draw_changes
         GROUP BY year
         ORDER BY year DESC`
      )
      .all() as Array<{ year: number; last_modified: string }>;

    return {
      archive: this.getArchiveState(),
      draws: draws.map((draw) => ({
        contestNumber: draw.contest_number,
        lastModified: requireInstant(draw.last_modified, `contest ${draw.contest_number}`),
      })),
      years: years.map((summary) => ({
        year: summary.year,
        lastModified: requireInstant(summary.last_modified, `year ${summary.year}`),
      })),
    };
  }

  private getArchiveState(): ArchiveState {
    const row = this.db
      .prepare(
        `WITH ${DRAW_CHANGES_CTE}
         SELECT COUNT(*) AS total_draws,
                MAX(contest_number) AS last_contest,
                MAX(draw_date) AS last_draw_date,
                MAX(page_modified) AS last_modified
         FROM draw_changes`
      )
      .get() as {
      total_draws: number;
      last_contest: number | null;
      last_draw_date: string | null;
      last_modified: string | null;
    };
    return {
      totalDraws: row.total_draws,
      lastContestNumber: row.last_contest,
      lastDrawDate: row.last_draw_date,
      lastModified: toIsoInstant(row.last_modified),
    };
  }

  /** Frequency and previous appearance of each drawn number, counting only up to `contest`. */
  private getNumberHistoryAt(contest: number, numbers: number[]): DrawNumberHistory[] {
    const rows = this.db
      .prepare(
        `WITH ${NUMBER_OCCURRENCES_CTE}
         SELECT number,
                COUNT(*) AS times_drawn,
                MAX(CASE WHEN contest_number < ?7 THEN contest_number END) AS previous_contest
         FROM occurrences
         WHERE contest_number <= ?7 AND number IN (?1, ?2, ?3, ?4, ?5, ?6)
         GROUP BY number`
      )
      .all(...numbers, contest) as Array<{
      number: number;
      times_drawn: number;
      previous_contest: number | null;
    }>;
    const byNumber = new Map(rows.map((row) => [row.number, row] as const));
    const previousDraw = this.db.prepare(
      `SELECT draw_date,
              (SELECT COUNT(*) FROM draws AS between_draws
               WHERE between_draws.contest_number > ?1 AND between_draws.contest_number < ?2) AS draws_between
       FROM draws WHERE contest_number = ?1`
    );

    return numbers.map((number): DrawNumberHistory => {
      const row = byNumber.get(number);
      const previousContest = row?.previous_contest ?? null;
      const previous =
        previousContest === null
          ? undefined
          : (previousDraw.get(previousContest, contest) as
              | { draw_date: string; draws_between: number }
              | undefined);
      return {
        number,
        timesDrawn: row?.times_drawn ?? 1,
        previous:
          previousContest !== null && previous
            ? {
                contestNumber: previousContest,
                drawDate: previous.draw_date,
                drawsBetween: previous.draws_between,
              }
            : null,
      };
    });
  }

  private getSumContextAt(contest: number, sum: number): DrawPage['sumContext'] {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS earlier_draws,
                COALESCE(SUM(CASE WHEN number_1 + number_2 + number_3 + number_4 + number_5 + number_6 < ?2
                             THEN 1 ELSE 0 END), 0) AS lower_sum
         FROM draws WHERE contest_number < ?1`
      )
      .get(contest, sum) as { earlier_draws: number; lower_sum: number };
    return { earlierDraws: row.earlier_draws, lowerSum: row.lower_sum };
  }

  private getYearSummaries(): YearSummary[] {
    const rows = this.db
      .prepare(
        `SELECT CAST(substr(draw_date, 1, 4) AS INTEGER) AS year,
                COUNT(*) AS draw_count,
                MIN(contest_number) AS first_contest,
                MAX(contest_number) AS last_contest,
                MIN(draw_date) AS first_draw_date,
                MAX(draw_date) AS last_draw_date
         FROM draws
         GROUP BY year
         ORDER BY year DESC`
      )
      .all() as YearRow[];
    return rows.map(toYearSummary);
  }

  private computeNumberSummaries(): {
    archive: ArchiveState;
    summaries: NumberSummary[];
    drawIndexByContest: Map<number, number>;
  } {
    const ordered = this.db
      .prepare('SELECT contest_number FROM draws ORDER BY contest_number ASC')
      .all() as Array<{ contest_number: number }>;
    const drawIndexByContest = new Map(
      ordered.map((draw, index) => [draw.contest_number, index + 1] as const)
    );
    const totalDraws = ordered.length;

    // SQLite "bare column" rule: with a single MAX() aggregate, draw_date is taken
    // from the row holding that maximum, i.e. the date of the last appearance.
    const rows = this.db
      .prepare(
        `WITH ${NUMBER_OCCURRENCES_CTE}
         SELECT number, COUNT(*) AS frequency, MAX(contest_number) AS last_contest, draw_date
         FROM occurrences
         GROUP BY number`
      )
      .all() as Array<{ number: number; frequency: number; last_contest: number; draw_date: string }>;
    const byNumber = new Map(rows.map((row) => [row.number, row] as const));

    const frequencies = Array.from(
      { length: 60 },
      (_, index) => byNumber.get(index + 1)?.frequency ?? 0
    );
    const summaries = frequencies.map((frequency, index): NumberSummary => {
      const row = byNumber.get(index + 1);
      const lastPosition = row ? drawIndexByContest.get(row.last_contest) : undefined;
      return {
        number: index + 1,
        frequency,
        rank: 1 + frequencies.filter((other) => other > frequency).length,
        lastAppearance:
          row && lastPosition !== undefined
            ? {
                contestNumber: row.last_contest,
                drawDate: row.draw_date,
                drawsSince: totalDraws - lastPosition,
              }
            : null,
      };
    });

    return { archive: this.getArchiveState(), summaries, drawIndexByContest };
  }
}
