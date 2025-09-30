import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Chart, type ChartData } from "@/components/ui/chart";
import { StatList } from "@/components/dashboard/stat-list";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonStyles } from "@/components/ui/button-variants";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export type HighlightNumber = {
  dezena: number;
  hits: number;
  percentage: number;
  contestsSinceLast: number | null;
};

export type PairHighlight = {
  combination: [number, number];
  hits: number;
};

export type StatsDashboardProps = {
  totalDraws: number;
  lastSync: Date | null;
  averageSum: number;
  parityEvenPercent: number;
  parityOddPercent: number;
  hotNumbers: HighlightNumber[];
  coldNumbers: HighlightNumber[];
  quadrantDistribution: { range: string; total: number }[];
  topPairs: PairHighlight[];
};

export function StatsDashboard({
  totalDraws,
  lastSync,
  averageSum,
  parityEvenPercent,
  parityOddPercent,
  hotNumbers,
  coldNumbers,
  quadrantDistribution,
  topPairs,
}: StatsDashboardProps) {
  const quadrantChart: ChartData[] = quadrantDistribution.map(
    (item, index) => ({
      label: item.range,
      value: item.total,
      color: quadrantColor(index),
    }),
  );
  const hasData = totalDraws > 0;
  const strongestQuadrant = quadrantDistribution.reduce<{
    range: string;
    total: number;
  } | null>((acc, item) => {
    if (!acc || item.total > acc.total) {
      return item;
    }
    return acc;
  }, null);

  if (!hasData) {
    return (
      <Card className="border border-dashed border-slate-300 bg-white/60 dark:border-slate-700 dark:bg-white/5">
        <CardContent className="px-6 py-10">
          <EmptyState
            title="Sincronize concursos para liberar estatísticas"
            description="Assim que os concursos oficiais forem carregados, exibiremos frequências, pares e quadrantes atualizados em tempo real."
            icon={
              <svg
                className="h-12 w-12 text-brand-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 17L9 20l-.75-3m.75 3h6l-.75-3m-4.5 0h3m-7.112-9.445l.53 3.182a9 9 0 0015.175 4.2l.656-.656a1.125 1.125 0 00-.819-1.92H18.75V4.184a1.125 1.125 0 00-1.394-1.09 12.75 12.75 0 00-8.719 6.461z"
                />
              </svg>
            }
          />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/generate" className={buttonStyles("primary", "md")}>
              Gerar apostas
            </Link>
            <Link href="/docs" className={buttonStyles("ghost", "md")}>
              Ver plano de sincronização
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-14">
      <div className="grid gap-6 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        <Card variant="compact">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Concursos carregados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {numberFormatter.format(totalDraws)}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Última sincronização:{" "}
              {lastSync ? dateFormatter.format(lastSync) : "a executar"}
            </p>
          </CardContent>
        </Card>

        <Card variant="compact">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Soma média (janela)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {numberFormatter.format(averageSum)}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Mantendo a paridade equilibrada em{" "}
              {percentFormatter.format(parityEvenPercent)} pares /{" "}
              {percentFormatter.format(parityOddPercent)} ímpares
            </p>
          </CardContent>
        </Card>

        <Card variant="compact">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Quadrante mais forte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {strongestQuadrant ? (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {strongestQuadrant.range}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {numberFormatter.format(strongestQuadrant.total)} dezenas
                  sorteadas no período
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sincronize concursos para visualizar a distribuição.
              </p>
            )}
          </CardContent>
        </Card>

        <Card variant="compact">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Pares em destaque
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPairs.length > 0 ? (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatPair(topPairs[0].combination)}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {numberFormatter.format(topPairs[0].hits)} coocorrências
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum par disponível.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por faixas</CardTitle>
            <CardDescription>
              Quantidade total de dezenas sorteadas em cada faixa de 10 números.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[260px]">
              <Chart
                data={quadrantChart}
                type="bar"
                height={260}
                showLabels
                showValues
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participação percentual</CardTitle>
            <CardDescription>
              Visualize a representatividade de cada quadrante no período.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[260px]">
              <Chart
                data={quadrantChart}
                type="donut"
                height={260}
                showLabels
                showValues
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-6 p-6">
            <StatList
              title="Números quentes"
              description="Maior frequência na janela analisada."
              badge={{ label: "Top 5", variant: "success" }}
              items={hotNumbers}
              accent="hot"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-6 p-6">
            <StatList
              title="Números frios"
              description="Menor incidência recente – úteis para diversificação."
              badge={{ label: "Top 5", variant: "secondary" }}
              items={coldNumbers}
              accent="cold"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pares mais frequentes</CardTitle>
          <CardDescription>
            Combine insights de pares com as estratégias de geração para evitar
            duplicidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {topPairs.map((pair) => (
              <div
                key={`${pair.combination[0]}-${pair.combination[1]}`}
                className="flex items-center justify-between rounded-xl border border-white/20 bg-white/70 px-4 py-3 shadow-soft dark:border-white/10 dark:bg-white/5"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {formatPair(pair.combination)}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {numberFormatter.format(pair.hits)} ocorrências
                </span>
              </div>
            ))}
            {topPairs.length === 0 && (
              <p className="col-span-full text-sm text-slate-500 dark:text-slate-400">
                Execute a sincronização para visualizar pares recorrentes.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function StatsDashboardSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-48 animate-pulse rounded-2xl border border-white/20 bg-white/70 dark:border-white/10 dark:bg-white/5"
        />
      ))}
    </div>
  );
}

function quadrantColor(index: number) {
  const palette = [
    "#15803d",
    "#f97316",
    "#0f172a",
    "#be123c",
    "#1d4ed8",
    "#16a34a",
  ];
  return palette[index % palette.length];
}

function formatPair([a, b]: [number, number]) {
  return `${a.toString().padStart(2, "0")} · ${b.toString().padStart(2, "0")}`;
}
