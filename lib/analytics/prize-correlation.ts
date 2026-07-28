import { getDatabase } from '@/lib/db';
import { roundTo } from '@/lib/utils';

export interface PrizeCorrelation {
  number: number;
  frequency: number;
  averagePrizeSena: number;
  averagePrizeQuina: number;
  totalWinsSena: number;
  totalWinsQuina: number;
  correlationScore: number;
}

export interface PrizeCorrelationSets {
  luckyNumbers: PrizeCorrelation[];
  unluckyNumbers: PrizeCorrelation[];
}

export class PrizeCorrelationEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  getPrizeCorrelation(): PrizeCorrelation[] {
    // Get overall average prizes for comparison
    const overallAvgSena = (
      this.db
        .prepare('SELECT AVG(prize_sena) as avg FROM draws WHERE prize_sena > 0')
        .get() as { avg: number }
    ).avg || 0;

    // Single optimized query using UNION ALL
    const query = `
      WITH number_prizes AS (
        SELECT 
          number_1 as num, 
          prize_sena, 
          prize_quina, 
          CASE WHEN winners_sena > 0 THEN 1 ELSE 0 END as has_winner_sena,
          CASE WHEN winners_quina > 0 THEN 1 ELSE 0 END as has_winner_quina
        FROM draws
        UNION ALL
        SELECT number_2, prize_sena, prize_quina, 
          CASE WHEN winners_sena > 0 THEN 1 ELSE 0 END,
          CASE WHEN winners_quina > 0 THEN 1 ELSE 0 END
        FROM draws
        UNION ALL
        SELECT number_3, prize_sena, prize_quina,
          CASE WHEN winners_sena > 0 THEN 1 ELSE 0 END,
          CASE WHEN winners_quina > 0 THEN 1 ELSE 0 END
        FROM draws
        UNION ALL
        SELECT number_4, prize_sena, prize_quina,
          CASE WHEN winners_sena > 0 THEN 1 ELSE 0 END,
          CASE WHEN winners_quina > 0 THEN 1 ELSE 0 END
        FROM draws
        UNION ALL
        SELECT number_5, prize_sena, prize_quina,
          CASE WHEN winners_sena > 0 THEN 1 ELSE 0 END,
          CASE WHEN winners_quina > 0 THEN 1 ELSE 0 END
        FROM draws
        UNION ALL
        SELECT number_6, prize_sena, prize_quina,
          CASE WHEN winners_sena > 0 THEN 1 ELSE 0 END,
          CASE WHEN winners_quina > 0 THEN 1 ELSE 0 END
        FROM draws
      )
      -- Per-number averages must share the overallAvg* basis (prize > 0 only):
      -- including zero-prize accumulated draws in the numerator but not the
      -- denominator dragged every correlationScore below 1, emptying luckyNumbers.
      SELECT
        num as number,
        COUNT(*) as frequency,
        COALESCE(AVG(CASE WHEN prize_sena > 0 THEN prize_sena END), 0) as avg_sena,
        COALESCE(AVG(CASE WHEN prize_quina > 0 THEN prize_quina END), 0) as avg_quina,
        SUM(has_winner_sena) as total_wins_sena,
        SUM(has_winner_quina) as total_wins_quina
      FROM number_prizes
      GROUP BY num
      ORDER BY num
    `;

    const queryResults = this.db.prepare(query).all() as Array<{
      number: number;
      frequency: number;
      avg_sena: number;
      avg_quina: number;
      total_wins_sena: number;
      total_wins_quina: number;
    }>;

    const results: PrizeCorrelation[] = queryResults.map((row) => {
      const correlationScore = overallAvgSena > 0 ? row.avg_sena / overallAvgSena : 1;

      return {
        number: row.number,
        frequency: row.frequency,
        averagePrizeSena: roundTo(row.avg_sena || 0),
        averagePrizeQuina: roundTo(row.avg_quina || 0),
        totalWinsSena: row.total_wins_sena,
        totalWinsQuina: row.total_wins_quina,
        correlationScore: roundTo(correlationScore),
      };
    });

    // Sort by correlation score (highest first)
    return results.sort((a, b) => b.correlationScore - a.correlationScore);
  }

  getCorrelationSets(
    luckyLimit: number = 10,
    unluckyLimit: number = 10
  ): PrizeCorrelationSets {
    const correlations = this.getPrizeCorrelation();

    return {
      luckyNumbers: correlations
        .filter((correlation) => correlation.correlationScore > 1)
        .slice(0, luckyLimit),
      unluckyNumbers: correlations
        .filter((correlation) => correlation.correlationScore < 1)
        .sort((a, b) => a.correlationScore - b.correlationScore)
        .slice(0, unluckyLimit),
    };
  }

  getLuckyNumbers(limit: number = 10): PrizeCorrelation[] {
    return this.getCorrelationSets(limit, 0).luckyNumbers;
  }

  getUnluckyNumbers(limit: number = 10): PrizeCorrelation[] {
    return this.getCorrelationSets(0, limit).unluckyNumbers;
  }
}
