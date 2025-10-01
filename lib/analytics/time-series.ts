import { getDatabase } from '@/lib/db';

export interface TimeSeriesData {
  period: string;
  [key: string]: string | number;
}

export type TimePeriod = 'yearly' | 'quarterly' | 'monthly';

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
    switch (period) {
      case 'yearly':
        return "strftime('%Y', draw_date)";
      case 'quarterly':
        return "strftime('%Y-Q', draw_date) || CAST((CAST(strftime('%m', draw_date) AS INTEGER) - 1) / 3 + 1 AS TEXT)";
      case 'monthly':
        return "strftime('%Y-%m', draw_date)";
      default:
        return "strftime('%Y', draw_date)";
    }
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

