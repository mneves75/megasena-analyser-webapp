import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/stats-card';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils';
import type { DrawStatistics, NumberFrequency } from '@/lib/analytics/statistics';
import {
  BarChart3,
  TrendingUp,
  Trophy,
  Calculator,
  Database,
  Calendar,
  Sparkles,
  Activity,
} from 'lucide-react';
import { LotteryBall } from '@/components/lottery-ball';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic';

interface RecentDraw {
  contestNumber: number;
  drawDate: string;
  numbers: number[];
  prizeSena: number;
  accumulated: boolean;
}

interface DashboardApiResponse {
  statistics: DrawStatistics;
  recentDraws: RecentDraw[];
}

async function getDashboardData(): Promise<DashboardApiResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/dashboard`, {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  
  return (await response.json()) as DashboardApiResponse;
}

export default async function DashboardPage() {
  const { statistics, recentDraws } = await getDashboardData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold">
              Mega-Sena Analyser
            </Link>
            <div className="flex gap-2">
              <Link href="/dashboard/statistics">
                <Button variant="ghost">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Estatísticas
                </Button>
              </Link>
              <Link href="/dashboard/generator">
                <Button variant="default">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Apostas
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral das estatísticas e últimos sorteios da Mega-Sena
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatsCard
            title="Total de Sorteios"
            value={formatNumber(statistics.totalDraws)}
            icon={<Database className="h-4 w-4" />}
            description="Sorteios registrados"
          />
          <StatsCard
            title="Último Sorteio"
            value={`#${statistics.lastContestNumber || '-'}`}
            icon={<Calendar className="h-4 w-4" />}
            description={statistics.lastDrawDate || 'Sem dados'}
          />
          <StatsCard
            title="Taxa de Acumulação"
            value={formatPercentage(statistics.accumulationRate)}
            icon={<TrendingUp className="h-4 w-4" />}
            description={`${statistics.accumulatedCount} sorteios acumulados`}
          />
          <StatsCard
            title="Prêmio Médio Sena"
            value={formatCurrency(statistics.averagePrizeSena)}
            icon={<Trophy className="h-4 w-4" />}
            description="Média de prêmios pagos"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Números Mais Sorteados
              </CardTitle>
              <CardDescription>Top 10 números com maior frequência</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {statistics.mostFrequentNumbers.slice(0, 10).map((num: NumberFrequency) => (
                  <div key={num.number} className="flex flex-col items-center gap-1">
                    <LotteryBall number={num.number} size="md" />
                    <span className="text-xs text-muted-foreground">{num.frequency}x</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Números Menos Sorteados
              </CardTitle>
              <CardDescription>Top 10 números com menor frequência</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {statistics.leastFrequentNumbers.slice(0, 10).map((num: NumberFrequency) => (
                  <div key={num.number} className="flex flex-col items-center gap-1">
                    <LotteryBall number={num.number} size="md" />
                    <span className="text-xs text-muted-foreground">{num.frequency}x</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Últimos Sorteios</CardTitle>
            <CardDescription>Os 5 sorteios mais recentes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDraws.map((draw: RecentDraw) => (
                <div
                  key={draw.contestNumber}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-smooth"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">Concurso #{draw.contestNumber}</span>
                      <span className="text-sm text-muted-foreground">{draw.drawDate}</span>
                      {draw.accumulated && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          Acumulado
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {draw.numbers.map((num: number) => (
                        <LotteryBall key={num} number={num} size="sm" />
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Prêmio Sena</div>
                    <div className="font-semibold">{formatCurrency(draw.prizeSena)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/statistics">
            <Card className="cursor-pointer hover:shadow-glow transition-smooth h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Estatísticas Detalhadas
                </CardTitle>
                <CardDescription>
                  Análise completa de frequências, padrões e tendências
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/generator">
            <Card className="cursor-pointer hover:shadow-glow transition-smooth h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Gerador de Apostas
                </CardTitle>
                <CardDescription>
                  Crie apostas inteligentes baseadas em estratégias avançadas
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
