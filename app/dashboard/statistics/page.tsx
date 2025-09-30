import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LotteryBall } from '@/components/lottery-ball';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { STATISTICS_DISPLAY } from '@/lib/constants';
import type { NumberFrequency, Pattern } from '@/lib/analytics/statistics';

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic';

interface StatisticsApiResponse {
  frequencies: NumberFrequency[];
  patterns: Pattern[];
}

async function getStatisticsData(): Promise<StatisticsApiResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/statistics`, {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch statistics data');
  }
  
  return (await response.json()) as StatisticsApiResponse;
}

export default async function StatisticsPage() {
  const { frequencies, patterns } = await getStatisticsData();

  const topHot = frequencies.slice(0, STATISTICS_DISPLAY.TOP_NUMBERS_COUNT);
  const topCold = [...frequencies].reverse().slice(0, STATISTICS_DISPLAY.TOP_NUMBERS_COUNT);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-2xl font-bold">
              Mega-Sena Analyser
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
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
