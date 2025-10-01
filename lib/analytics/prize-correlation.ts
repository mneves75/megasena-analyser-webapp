import { getDatabase } from '@/lib/db';

export interface PrizeCorrelation {
  number: number;
  frequency: number;
  averagePrizeSena: number;
  averagePrizeQuina: number;
  totalWinsSena: number;
  totalWinsQuina: number;
  correlationScore: number;
}

export class PrizeCorrelationEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  getPrizeCorrelation(): PrizeCorrelation[] {
    const results: PrizeCorrelation[] = [];

    // Get overall average prizes for comparison
    const overallAvgSena = (
      this.db
        .prepare('SELECT AVG(prize_sena) as avg FROM draws WHERE prize_sena > 0')
        .get() as { avg: number }
    ).avg || 0;

    for (let num = 1; num <= 60; num++) {
      let frequency = 0;
      let totalPrizeSena = 0;
      let totalPrizeQuina = 0;
      let totalWinsSena = 0;
      let totalWinsQuina = 0;
      let drawsWithNumber = 0;

      // Check each column
      for (let col = 1; col <= 6; col++) {
        const results = this.db
          .prepare(
            `SELECT 
              COUNT(*) as count,
              SUM(prize_sena) as sum_sena,
              SUM(prize_quina) as sum_quina,
              SUM(CASE WHEN winners_sena > 0 THEN 1 ELSE 0 END) as wins_sena,
              SUM(CASE WHEN winners_quina > 0 THEN 1 ELSE 0 END) as wins_quina
             FROM draws
             WHERE number_${col} = ?`
          )
          .get(num) as {
          count: number;
          sum_sena: number;
          sum_quina: number;
          wins_sena: number;
          wins_quina: number;
        };

        frequency += results.count;
        totalPrizeSena += results.sum_sena || 0;
        totalPrizeQuina += results.sum_quina || 0;
        totalWinsSena += results.wins_sena || 0;
        totalWinsQuina += results.wins_quina || 0;
        drawsWithNumber += results.count;
      }

      const averagePrizeSena = drawsWithNumber > 0 ? totalPrizeSena / drawsWithNumber : 0;
      const averagePrizeQuina = drawsWithNumber > 0 ? totalPrizeQuina / drawsWithNumber : 0;

      // Correlation score: ratio of this number's avg prize to overall avg
      const correlationScore = overallAvgSena > 0 ? averagePrizeSena / overallAvgSena : 1;

      results.push({
        number: num,
        frequency,
        averagePrizeSena: Math.round(averagePrizeSena * 100) / 100,
        averagePrizeQuina: Math.round(averagePrizeQuina * 100) / 100,
        totalWinsSena,
        totalWinsQuina,
        correlationScore: Math.round(correlationScore * 100) / 100,
      });
    }

    // Sort by correlation score (highest first)
    return results.sort((a, b) => b.correlationScore - a.correlationScore);
  }

  getLuckyNumbers(limit: number = 10): PrizeCorrelation[] {
    return this.getPrizeCorrelation()
      .filter((c) => c.correlationScore > 1)
      .slice(0, limit);
  }

  getUnluckyNumbers(limit: number = 10): PrizeCorrelation[] {
    return this.getPrizeCorrelation()
      .filter((c) => c.correlationScore < 1)
      .sort((a, b) => a.correlationScore - b.correlationScore)
      .slice(0, limit);
  }
}

