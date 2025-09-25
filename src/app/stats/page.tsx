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
import { Stack } from "@/components/ui/stack";
import { loadStatsSummary } from "@/services/dashboard/stats-summary";
import { REPO_BASE_URL } from "@/config/repo";
const WINDOW_SIZE = 200;

export default function StatsPage() {
  return (
    <Stack gap="lg">
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
              href={`${REPO_BASE_URL}/docs/PHASE5_STAGE6_ROADMAP.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/PHASE5_STAGE6_ROADMAP.md
            </Link>
            .
          </span>
        </CardContent>
      </Card>
    </Stack>
  );
}

async function StatsDashboardSection() {
  const data = await loadStatsSummary({
    windowSize: WINDOW_SIZE,
    topPairsLimit: 9,
  });
  return <StatsDashboard {...data} />;
}
