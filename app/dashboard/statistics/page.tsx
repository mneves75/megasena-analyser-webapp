import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LotteryBall } from '@/components/lottery-ball';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, BarChart2, Link2, PieChart, Hash, Sigma, Flame, Trophy } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { STATISTICS_DISPLAY } from '@/lib/constants';
import type { NumberFrequency, Pattern } from '@/lib/analytics/statistics';
import type { DelayStats } from '@/lib/analytics/delay-analysis';
import type { DecadeStats } from '@/lib/analytics/decade-analysis';
import type { PairStats } from '@/lib/analytics/pair-analysis';
import type { ParityStats } from '@/lib/analytics/parity-analysis';
import type { PrimeStats } from '@/lib/analytics/prime-analysis';
import type { SumStats } from '@/lib/analytics/sum-analysis';
import type { StreakStats } from '@/lib/analytics/streak-analysis';
import type { PrizeCorrelation } from '@/lib/analytics/prize-correlation';
import { ThemeToggle } from '@/components/theme-toggle';
import { BarChart, DonutChart } from '@/components/charts';

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic';

interface StatisticsApiResponse {
  frequencies: NumberFrequency[];
  patterns: Pattern[];
  delays?: DelayStats[];
  delayDistribution?: Array<{ category: string; count: number }>;
  decades?: DecadeStats[];
  pairs?: PairStats[];
  parity?: ParityStats[];
  parityStats?: {
    mostCommon: ParityStats;
    leastCommon: ParityStats;
    balancedPercentage: number;
  };
  primes?: PrimeStats;
  sumStats?: SumStats;
  hotNumbers?: StreakStats[];
  coldNumbers?: StreakStats[];
  luckyNumbers?: PrizeCorrelation[];
  unluckyNumbers?: PrizeCorrelation[];
}

async function getStatisticsData(): Promise<StatisticsApiResponse> {
  // Fetch statistics from Bun API server to avoid Next.js compilation issues with bun:sqlite
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3201';
  
  // Build query string with all required parameters
  const params = new URLSearchParams({
    delays: 'true',
    decades: 'true',
    pairs: 'true',
    parity: 'true',
    primes: 'true',
    sum: 'true',
    streaks: 'true',
    prize: 'true',
  });
  
  const response = await fetch(`${baseUrl}/api/statistics?${params}`, {
    cache: 'no-store', // Force fresh data
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch statistics: ${response.statusText}`);
  }
  
  return response.json();
}

export default async function StatisticsPage() {
  const { frequencies, patterns, delays, delayDistribution, decades, pairs, parity, parityStats, primes, sumStats, hotNumbers, coldNumbers, luckyNumbers, unluckyNumbers } = await getStatisticsData();

  const topHot = frequencies.slice(0, STATISTICS_DISPLAY.TOP_NUMBERS_COUNT);
  const topCold = [...frequencies].reverse().slice(0, STATISTICS_DISPLAY.TOP_NUMBERS_COUNT);
  
  // Get delay category color helper
  const getDelayColor = (category: DelayStats['delayCategory']) => {
    switch (category) {
      case 'recent': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'normal': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'overdue': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
      case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-2xl font-bold">
              Mega-Sena Analyser
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="ghost">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Estatísticas Detalhadas</h1>
          <p className="text-muted-foreground">
            Análise completa de frequências e padrões dos sorteios
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Números Quentes (Top 20)
              </CardTitle>
              <CardDescription>Números mais sorteados historicamente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {topHot.map((num: NumberFrequency, index: number) => (
                  <div key={num.number} className="flex flex-col items-center gap-2">
                    <div className="text-xs font-semibold text-primary">#{index + 1}</div>
                    <LotteryBall number={num.number} size="md" />
                    <div className="text-center">
                      <div className="text-xs font-medium">{formatNumber(num.frequency)}x</div>
                      {num.lastDrawnContest && (
                        <div className="text-xs text-muted-foreground">
                          #{num.lastDrawnContest}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
                Números Frios (Top 20)
              </CardTitle>
              <CardDescription>Números menos sorteados historicamente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {topCold.map((num: NumberFrequency, index: number) => (
                  <div key={num.number} className="flex flex-col items-center gap-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      #{index + 1}
                    </div>
                    <LotteryBall number={num.number} size="md" />
                    <div className="text-center">
                      <div className="text-xs font-medium">{formatNumber(num.frequency)}x</div>
                      {num.lastDrawnContest && (
                        <div className="text-xs text-muted-foreground">
                          #{num.lastDrawnContest}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Padrões Detectados</CardTitle>
            <CardDescription>Análise de padrões nos sorteios históricos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {patterns.map((pattern: Pattern, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50"
                >
                  <div>
                    <div className="font-semibold mb-1">{pattern.description}</div>
                    <div className="text-sm text-muted-foreground">
                      Tipo: {pattern.type}
                      {pattern.lastSeen && ` | Última ocorrência: ${pattern.lastSeen}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{pattern.occurrences}</div>
                    <div className="text-xs text-muted-foreground">ocorrências</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {delays && delays.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Análise de Atraso
              </CardTitle>
              <CardDescription>
                Quantos sorteios desde a última aparição de cada número
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 md:grid-cols-10 gap-3 mb-6">
                {delays.slice(0, 30).map((delay) => (
                  <div key={delay.number} className="flex flex-col items-center gap-1">
                    <LotteryBall number={delay.number} size="sm" />
                    <div className="text-xs text-center">
                      <div className={`font-medium px-1.5 py-0.5 rounded text-xs ${getDelayColor(delay.delayCategory)}`}>
                        {delay.delayDraws}
                      </div>
                      <div className="text-muted-foreground mt-0.5">sorteios</div>
                    </div>
                  </div>
                ))}
              </div>
              
              {delayDistribution && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3">Distribuição de Atrasos</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {delayDistribution.map((dist) => (
                      <div key={dist.category} className="p-3 rounded-lg border bg-card/50">
                        <div className="text-2xl font-bold">{dist.count}</div>
                        <div className="text-xs text-muted-foreground">{dist.category}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {decades && decades.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                Distribuição por Dezena
              </CardTitle>
              <CardDescription>
                Análise de frequência por faixas de números
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={decades.map(d => ({
                  decade: d.decade,
                  'Ocorrências': d.totalOccurrences,
                  'Percentual': d.percentage,
                }))}
                xKey="decade"
                yKey="Ocorrências"
                color="hsl(var(--primary))"
              />
              
              <div className="mt-6 space-y-3">
                {decades.map((decade) => (
                  <div key={decade.decade} className="p-3 rounded-lg border bg-card/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{decade.decade}</span>
                      <div className="text-right">
                        <span className="text-lg font-bold">{decade.percentage}%</span>
                        <span className={`ml-2 text-sm ${decade.deviation > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {decade.deviation > 0 ? '+' : ''}{decade.deviation}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground">Top números:</span>
                      {decade.topNumbers.slice(0, 3).map((n) => (
                        <div key={n.number} className="flex items-center gap-1">
                          <LotteryBall number={n.number} size="xs" />
                          <span className="text-xs">({n.frequency})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {pairs && pairs.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Pares Mais Frequentes
              </CardTitle>
              <CardDescription>
                Números que aparecem juntos com maior frequência
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {pairs.slice(0, 20).map((pair, index) => (
                  <div key={`${pair.pair[0]}-${pair.pair[1]}`} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                      <div className="flex items-center gap-2">
                        <LotteryBall number={pair.pair[0]} size="sm" />
                        <span className="text-muted-foreground">+</span>
                        <LotteryBall number={pair.pair[1]} size="sm" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{pair.frequency}x</div>
                      <div className="text-xs text-muted-foreground">
                        Correlação: {pair.correlation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {parity && parity.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Distribuição Par/Ímpar
              </CardTitle>
              <CardDescription>
                Análise da quantidade de números pares vs ímpares
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                <DonutChart
                  data={parity.filter(p => p.occurrences > 0).map((p) => ({
                    name: `${p.evenCount} Pares`,
                    value: p.occurrences,
                    color: p.isBalanced ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-3))',
                  }))}
                />
                <div className="space-y-3">
                  {parityStats && (
                    <>
                      <div className="p-4 rounded-lg border bg-card/50">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          Mais Comum
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold">
                            {parityStats.mostCommon.evenCount} Pares / {parityStats.mostCommon.oddCount} Ímpares
                          </span>
                          <span className="text-2xl font-bold text-primary">
                            {parityStats.mostCommon.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border bg-card/50">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          Distribuições Balanceadas (2-4, 3-3, 4-2)
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {parityStats.balancedPercentage}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          dos sorteios
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {primes && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-primary" />
                Análise de Números Primos
              </CardTitle>
              <CardDescription>
                Distribuição e frequência de números primos (2, 3, 5, 7, 11, 13, ...)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3 mb-6">
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">Total de Primos</div>
                  <div className="text-3xl font-bold">{primes.totalPrimes}</div>
                  <div className="text-xs text-muted-foreground">de 60 números</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">Média por Sorteio</div>
                  <div className="text-3xl font-bold">{primes.averagePrimesPerDraw.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">números primos</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">Mais Comum</div>
                  <div className="text-3xl font-bold">{primes.mostCommonCount}</div>
                  <div className="text-xs text-muted-foreground">primos por sorteio</div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-3">Distribuição de Primos por Sorteio</h4>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {primes.distribution.map((dist) => (
                    <div key={dist.primeCount} className="p-2 rounded-lg border bg-card/50 text-center">
                      <div className="text-lg font-bold">{dist.primeCount}</div>
                      <div className="text-xs text-muted-foreground">{dist.percentage}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Top 10 Números Primos Mais Sorteados</h4>
                <div className="flex flex-wrap gap-3">
                  {primes.primeFrequencies.map((prime) => (
                    <div key={prime.number} className="flex flex-col items-center gap-1">
                      <LotteryBall number={prime.number} size="md" />
                      <span className="text-xs text-muted-foreground">{prime.frequency}x</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {sumStats && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sigma className="h-5 w-5 text-primary" />
                Distribuição de Soma
              </CardTitle>
              <CardDescription>
                Análise estatística da soma dos 6 números sorteados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-4 mb-6">
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">Média</div>
                  <div className="text-3xl font-bold">{sumStats.mean}</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">Mediana</div>
                  <div className="text-3xl font-bold">{sumStats.median}</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">Moda</div>
                  <div className="text-3xl font-bold">{sumStats.mode}</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">Desvio Padrão</div>
                  <div className="text-3xl font-bold">{sumStats.stdDev}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-5 mb-4">
                <div className="p-3 rounded-lg border bg-card/50 text-center">
                  <div className="text-xs text-muted-foreground">5º Percentil</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p5}</div>
                </div>
                <div className="p-3 rounded-lg border bg-card/50 text-center">
                  <div className="text-xs text-muted-foreground">25º Percentil</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p25}</div>
                </div>
                <div className="p-3 rounded-lg border bg-primary/20 text-center">
                  <div className="text-xs text-muted-foreground">50º Percentil</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p50}</div>
                </div>
                <div className="p-3 rounded-lg border bg-card/50 text-center">
                  <div className="text-xs text-muted-foreground">75º Percentil</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p75}</div>
                </div>
                <div className="p-3 rounded-lg border bg-card/50 text-center">
                  <div className="text-xs text-muted-foreground">95º Percentil</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p95}</div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Intervalo: {sumStats.minSum} - {sumStats.maxSum}
              </div>
            </CardContent>
          </Card>
        )}

        {hotNumbers && hotNumbers.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />
                Números em Sequência (Últimos 10 Sorteios)
              </CardTitle>
              <CardDescription>
                Números com maior e menor intensidade de aparição recente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-red-500" />
                    Números Quentes (Alta Intensidade)
                  </h4>
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                    {hotNumbers.map((hot) => (
                      <div key={hot.number} className="flex flex-col items-center gap-1">
                        <div className="relative">
                          <LotteryBall number={hot.number} size="sm" />
                          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            🔥
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-medium">{hot.recentOccurrences}x</div>
                          <div className="text-xs text-muted-foreground">
                            {hot.streakIntensity}×
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {coldNumbers && coldNumbers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-blue-500" />
                      Números Frios (Baixa Intensidade)
                    </h4>
                    <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                      {coldNumbers.map((cold) => (
                        <div key={cold.number} className="flex flex-col items-center gap-1">
                          <div className="relative">
                            <LotteryBall number={cold.number} size="sm" />
                            <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                              ❄️
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs font-medium">{cold.recentOccurrences}x</div>
                            <div className="text-xs text-muted-foreground">
                              {cold.streakIntensity}×
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {luckyNumbers && luckyNumbers.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Correlação com Prêmios
              </CardTitle>
              <CardDescription>
                Números que historicamente aparecem em sorteios com maiores prêmios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-3">Números &quot;Sortudos&quot; (Prêmios Acima da Média)</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {luckyNumbers.slice(0, 10).map((lucky) => (
                      <div key={lucky.number} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                        <div className="flex items-center gap-3">
                          <LotteryBall number={lucky.number} size="sm" />
                          <div>
                            <div className="text-xs text-muted-foreground">Prêmio Médio Sena</div>
                            <div className="font-semibold">R$ {(lucky.averagePrizeSena / 1_000_000).toFixed(2)}M</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Correlação</div>
                          <div className="text-lg font-bold text-green-600">{lucky.correlationScore}×</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {unluckyNumbers && unluckyNumbers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Números com Prêmios Abaixo da Média</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {unluckyNumbers.slice(0, 10).map((unlucky) => (
                        <div key={unlucky.number} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                          <div className="flex items-center gap-3">
                            <LotteryBall number={unlucky.number} size="sm" />
                            <div>
                              <div className="text-xs text-muted-foreground">Prêmio Médio Sena</div>
                              <div className="font-semibold">R$ {(unlucky.averagePrizeSena / 1_000_000).toFixed(2)}M</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Correlação</div>
                            <div className="text-lg font-bold text-orange-600">{unlucky.correlationScore}×</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Todos os Números (1-60)</CardTitle>
            <CardDescription>Frequência completa de todos os números possíveis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 md:grid-cols-10 gap-3">
              {frequencies.map((num: NumberFrequency) => (
                <div key={num.number} className="flex flex-col items-center gap-1">
                  <LotteryBall number={num.number} size="sm" />
                  <div className="text-xs text-center">
                    <div className="font-medium">{num.frequency}x</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
