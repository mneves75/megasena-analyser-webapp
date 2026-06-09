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
    
    // Get all unique periods
    const periods = this.db
      .prepare(
        `SELECT DISTINCT ${periodFormat} as period
         FROM draws
         ORDER BY period`
      )
      .all() as Array<{ period: string }>;

    const results: TimeSeriesData[] = [];

    for (const { period: periodValue } of periods) {
      const dataPoint: TimeSeriesData = { period: periodValue };

      for (const num of numbers) {
        let frequency = 0;

        for (let col = 1; col <= 6; col++) {
          const count = (
            this.db
              .prepare(
                `SELECT COUNT(*) as count
                 FROM draws
                 WHERE number_${col} = ?
                 AND ${periodFormat} = ?`
              )
              .get(num, periodValue) as { count: number }
          ).count;
          frequency += count;
        }

        dataPoint[`num_${num}`] = frequency;
      }

      results.push(dataPoint);
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

