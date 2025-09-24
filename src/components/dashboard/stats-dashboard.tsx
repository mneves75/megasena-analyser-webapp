import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Chart, type ChartData } from "@/components/ui/chart";

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
  const strongestQuadrant = quadrantDistribution.reduce<{
    range: string;
    total: number;
  } | null>((acc, item) => {
    if (!acc || item.total > acc.total) {
      return item;
    }
    return acc;
  }, null);

  return (
    <div className="space-y-12">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
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

        <Card>
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

        <Card>
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

        <Card>
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
            <Chart
              data={quadrantChart}
              type="bar"
              height={260}
              showLabels
              showValues
            />
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
            <Chart
              data={quadrantChart}
              type="donut"
              height={260}
              showLabels
              showValues
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Números quentes
              <Badge variant="success" size="sm">
                Top 5
              </Badge>
            </CardTitle>
            <CardDescription>
              Maior frequência na janela analisada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hotNumbers.map((item) => (
              <div
                key={`hot-${item.dezena}`}
                className="flex items-center justify-between rounded-xl bg-green-50 p-3 dark:bg-green-900/10"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-white text-sm font-semibold">
                    {item.dezena.toString().padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {numberFormatter.format(item.hits)} ocorrências
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {percentFormatter.format(item.percentage)} dos concursos
                      {item.contestsSinceLast !== null
                        ? ` · há ${item.contestsSinceLast} concursos`
                        : ""}
                    </p>
                  </div>
                </div>
                <Progress
                  value={item.percentage * 100}
                  size="sm"
                  variant="success"
                  className="w-20"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Números frios
              <Badge variant="secondary" size="sm">
                Top 5
              </Badge>
            </CardTitle>
            <CardDescription>
              Menor incidência recente — úteis para diversificação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {coldNumbers.map((item) => (
              <div
                key={`cold-${item.dezena}`}
                className="flex items-center justify-between rounded-xl bg-slate-100 p-3 dark:bg-slate-800/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-semibold dark:bg-slate-200 dark:text-slate-900">
                    {item.dezena.toString().padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {numberFormatter.format(item.hits)} ocorrências
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {percentFormatter.format(item.percentage)} dos concursos
                      {item.contestsSinceLast !== null
                        ? ` · há ${item.contestsSinceLast} concursos`
                        : ""}
                    </p>
                  </div>
                </div>
                <Progress
                  value={item.percentage * 100}
                  size="sm"
                  className="w-20"
                />
              </div>
            ))}
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
