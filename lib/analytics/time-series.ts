import { getDatabase } from '@/lib/db';

export interface TimeSeriesData {
  period: string;
  [key: string]: string | number;
}

export type TimePeriod = 'yearly' | 'quarterly' | 'monthly';

// SQLite cannot parameterize SQL expressions/identifiers, so these formats are
// interpolated as raw SQL. Keep them as a closed, frozen allowlist of hardcoded
// constants: any value (even an unsound `as TimePeriod` cast of untrusted input)
// can only ever resolve to one of these strings, never to attacker-supplied SQL.
const PERIOD_FORMATS = Object.freeze({
  yearly: "strftime('%Y', draw_date)",
  quarterly:
    "strftime('%Y-Q', draw_date) || CAST((CAST(strftime('%m', draw_date) AS INTEGER) - 1) / 3 + 1 AS TEXT)",
  monthly: "strftime('%Y-%m', draw_date)",
}) satisfies Record<TimePeriod, string>;

export class TimeSeriesEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  getFrequencyTimeSeries(
    numbers: number[],
    period: TimePeriod = 'yearly'
  ): TimeSeriesData[] {
    const periodFormat = this.getPeriodFormat(period);

    // Every period appears in the output, including those where none of the
    // requested numbers occurred (zero-filled below).
    const results: TimeSeriesData[] = [];
    const byPeriod = new Map<string, TimeSeriesData>();
    for (const periodValue of this.getAvailablePeriods(period)) {
      const dataPoint: TimeSeriesData = { period: periodValue };
      for (const num of numbers) {
        dataPoint[`num_${num}`] = 0;
      }
      byPeriod.set(periodValue, dataPoint);
      results.push(dataPoint);
    }

    if (numbers.length === 0) {
      return results;
    }

    // Single GROUP BY over the unpivoted number columns instead of one query
    // per period x number x column: the old shape issued O(periods * numbers * 6)
    // synchronous scans (~130k queries for monthly x 60 numbers), which blocked
    // the single-threaded server long enough to be a DoS vector.
    const placeholders = numbers.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `WITH occurrences(draw_date, num) AS (
           SELECT draw_date, number_1 FROM draws
           UNION ALL SELECT draw_date, number_2 FROM draws
           UNION ALL SELECT draw_date, number_3 FROM draws
           UNION ALL SELECT draw_date, number_4 FROM draws
           UNION ALL SELECT draw_date, number_5 FROM draws
           UNION ALL SELECT draw_date, number_6 FROM draws
         )
         SELECT ${periodFormat} as period, num, COUNT(*) as frequency
         FROM occurrences
         WHERE num IN (${placeholders})
         GROUP BY period, num`
      )
      .all(...numbers) as Array<{ period: string; num: number; frequency: number }>;

    for (const row of rows) {
      const dataPoint = byPeriod.get(row.period);
      if (dataPoint) {
        dataPoint[`num_${row.num}`] = row.frequency;
      }
    }

    return results;
  }

  private getPeriodFormat(period: TimePeriod): string {
    // Fall back to the yearly format for any value outside the allowlist, so the
    // interpolated SQL is always one of the frozen constants above.
    return PERIOD_FORMATS[period] ?? PERIOD_FORMATS.yearly;
  }

  getAvailablePeriods(period: TimePeriod = 'yearly'): string[] {
    const periodFormat = this.getPeriodFormat(period);
    
    const periods = this.db
      .prepare(
        `SELECT DISTINCT ${periodFormat} as period
         FROM draws
         ORDER BY period`
      )
      .all() as Array<{ period: string }>;

    return periods.map((p) => p.period);
  }
}

