import { Suspense } from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button-variants";
import {
  StatsDashboard,
  StatsDashboardSkeleton,
} from "@/components/dashboard/stats-dashboard";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  getFrequencies,
  getPairs,
  getSums,
  getQuadrants,
  getRecency,
} from "@/services/stats";
import { prisma } from "@/lib/prisma";

const REPO_BASE =
  "https://github.com/mneves75/megasena-analyser-webapp/blob/main";
const WINDOW_SIZE = 200;

export default function StatsPage() {
  return (
    <div className="flex flex-col gap-12">
      <Breadcrumb items={[{ label: "Estatísticas", current: true }]} />

      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tightest text-slate-900 dark:text-white">
          Estatísticas e insights históricos
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Consulte tendências atualizadas de frequência, pares, quadrantes e
          distribuições para apoiar estratégias de geração de apostas.
        </p>
      </header>

      <Suspense fallback={<StatsDashboardSkeleton />}>
        <StatsDashboardSection />
      </Suspense>

      <Card className="bg-gradient-to-r from-brand-500/15 to-purple-500/20 dark:from-brand-500/10 dark:to-purple-500/15">
        <CardHeader>
          <CardTitle>Próximos passos</CardTitle>
          <CardDescription>
            Evolua este dashboard conectando filtros dinâmicos, gráficos
            temporais e alertas automáticos após cada sincronização.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
          <Link href="/docs" className={buttonStyles("primary", "md")}>
            Revisar plano completo
          </Link>
          <span>
            Consulte o documento completo em
            <Link
              className="ml-1 underline-offset-4 hover:underline"
              href={`${REPO_BASE}/docs/PHASE5_STAGE6_ROADMAP.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/PHASE5_STAGE6_ROADMAP.md
            </Link>
            .
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

async function StatsDashboardSection() {
  const data = await loadStatsData();
  return <StatsDashboard {...data} />;
}

async function loadStatsData() {
  const [frequencies, pairs, sums, quadrants, recency, lastSyncMeta] =
    await Promise.all([
      getFrequencies({ window: WINDOW_SIZE }),
      getPairs({ window: WINDOW_SIZE, limit: 9 }),
      getSums({ window: WINDOW_SIZE }),
      getQuadrants({ window: WINDOW_SIZE }),
      getRecency({}),
      prisma.meta.findUnique({ where: { key: "last_sync" } }),
    ]);

  const totalNumbers = sums.parity.even + sums.parity.odd;
  const parityEvenPercent =
    totalNumbers > 0 ? sums.parity.even / totalNumbers : 0;
  const parityOddPercent =
    totalNumbers > 0 ? sums.parity.odd / totalNumbers : 0;

  const recencyMap = new Map(
    recency.map((item) => [item.dezena, item.contestsSinceLast]),
  );

  const hotNumbers = frequencies.items.slice(0, 5).map((item) => ({
    dezena: item.dezena,
    hits: item.hits,
    percentage: item.frequency,
    contestsSinceLast: recencyMap.get(item.dezena) ?? null,
  }));

  const coldNumbersSource =
    frequencies.items.length > 5
      ? frequencies.items.slice(-5)
      : frequencies.items.slice().reverse();
  const coldNumbers = [...coldNumbersSource]
    .sort((a, b) => a.hits - b.hits)
    .map((item) => ({
      dezena: item.dezena,
      hits: item.hits,
      percentage: item.frequency,
      contestsSinceLast: recencyMap.get(item.dezena) ?? null,
    }));

  const topPairs = pairs.map((pair) => ({
    combination: [pair.combination[0], pair.combination[1]] as [number, number],
    hits: pair.hits,
  }));

  const lastSyncValue = lastSyncMeta?.value
    ? new Date(lastSyncMeta.value)
    : null;
  const lastSync =
    lastSyncValue && !Number.isNaN(lastSyncValue.getTime())
      ? lastSyncValue
      : null;

  return {
    totalDraws: frequencies.totalDraws,
    lastSync,
    averageSum: Math.round(sums.average ?? 0),
    parityEvenPercent,
    parityOddPercent,
    hotNumbers,
    coldNumbers,
    quadrantDistribution: quadrants,
    topPairs,
  } as const;
}
