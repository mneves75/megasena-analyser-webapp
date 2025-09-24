import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button-variants";
import { getFrequencies, getSums, getRecency } from "@/services/stats";
import { getPriceForK, getPricingMetadata } from "@/services/pricing";
import { prisma } from "@/lib/prisma";

type Highlight = {
  label: string;
  value: string;
  description: string;
};

type TrendingNumber = {
  dezena: number;
  hits: number;
  frequency: number;
  contestsSinceLast: number | null;
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatDate(value: Date | null | undefined) {
  if (!value || Number.isNaN(value.getTime())) {
    return "ainda não sincronizado";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

type HomeData = {
  highlights: Highlight[];
  topNumbers: TrendingNumber[];
  totalDraws: number;
  averageSum: number;
  lastSyncDate: Date | null;
  paritySummary: string;
  windowSize: number;
};

async function loadHomeData(): Promise<HomeData> {
  const frequencyWindow = 200;
  const [
    frequencies,
    sums,
    pricingMeta,
    priceK6,
    recency,
    lastSyncMeta,
    latestDraw,
  ] = await Promise.all([
    getFrequencies({ window: frequencyWindow }),
    getSums({ window: frequencyWindow }),
    getPricingMetadata(),
    getPriceForK(6),
    getRecency({}),
    prisma.meta.findUnique({ where: { key: "last_sync" } }),
    prisma.draw.findFirst({
      orderBy: { data: "desc" },
      select: { data: true, concurso: true },
    }),
  ]);

  const parsedLastSync = lastSyncMeta?.value
    ? new Date(lastSyncMeta.value)
    : null;
  const lastSyncDate =
    parsedLastSync && !Number.isNaN(parsedLastSync.getTime())
      ? parsedLastSync
      : null;
  const recencyMap = new Map(
    recency.map((item) => [item.dezena, item.contestsSinceLast]),
  );

  const totalParity = sums.parity.even + sums.parity.odd;
  const paritySummary = totalParity
    ? `${Math.round((sums.parity.even / totalParity) * 100)}% pares · ${Math.round(
        (sums.parity.odd / totalParity) * 100,
      )}% ímpares`
    : "Sem dados suficientes";

  const highlights: Highlight[] = [
    {
      label: "Concursos processados",
      value: numberFormatter.format(frequencies.totalDraws),
      description: frequencies.windowStart
        ? `Cobertura a partir do concurso ${frequencies.windowStart}`
        : "Sincronize para ampliar a cobertura.",
    },
    {
      label: "Última sincronização",
      value: formatDate(lastSyncDate),
      description: latestDraw?.data
        ? `Concurso ${latestDraw.concurso} em ${formatDate(latestDraw.data)}`
        : "Nenhum concurso carregado ainda.",
    },
    {
      label: "Preço base oficial",
      value: currencyFormatter.format(priceK6.costCents / 100),
      description: pricingMeta.lastOfficialUpdate
        ? `Atualizado em ${formatDate(pricingMeta.lastOfficialUpdate)}${
            priceK6.fonte ? ` · Fonte: ${priceK6.fonte}` : ""
          }`
        : "Use `npm run db:seed` para registrar os valores.",
    },
    {
      label: `Soma média (janela ${frequencyWindow})`,
      value: numberFormatter.format(Math.round(sums.average ?? 0)),
      description: paritySummary,
    },
  ];

  const topNumbers: TrendingNumber[] = frequencies.items
    .slice(0, 6)
    .map((item) => {
      return {
        dezena: item.dezena,
        hits: item.hits,
        frequency: item.frequency,
        contestsSinceLast: recencyMap.get(item.dezena) ?? null,
      };
    });

  return {
    highlights,
    topNumbers,
    totalDraws: frequencies.totalDraws,
    averageSum: Math.round(sums.average ?? 0),
    lastSyncDate,
    paritySummary,
    windowSize: frequencyWindow,
  };
}

export default async function Home() {
  const homeData = await loadHomeData();
  const workflow = [
    {
      title: "Sincronize os concursos",
      description:
        "Use o comando /api/sync ou cron agendado para manter o SQLite atualizado com dados oficiais da CAIXA.",
    },
    {
      title: "Analise com profundidade",
      description:
        "Visualize frequências, pares, trincas, recência e distribuições num dashboard premium.",
    },
    {
      title: "Gere apostas otimizadas",
      description:
        "Informe o orçamento e deixe o motor sugerir combinações sem duplicatas e dentro das regras vigentes.",
    },
  ];

  return (
    <div className="relative z-10 flex flex-col gap-16">
      <section className="grid gap-14 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] xl:items-start">
        <div
          data-card
          className="rounded-3xl border border-white/10 bg-[rgba(var(--surface-muted),0.92)] p-6 sm:p-8 xl:p-10 dark:border-white/5 dark:bg-[rgba(var(--surface-elevated),0.8)]"
        >
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">
            Projeto em construção guiada
          </p>
          <h1 className="text-3xl font-semibold tracking-tightest text-slate-900 sm:text-4xl lg:text-5xl sm:leading-tight dark:text-white">
            Inteligência estatística para cada aposta da Mega-Sena
          </h1>
          <p className="mt-6 max-w-xl text-lg tracking-tight text-slate-600 dark:text-slate-300">
            Centralize ingestão de dados oficiais, análises históricas e geração
            de apostas otimizadas com uma experiência única. Construa em fases,
            valide cada release e mantenha responsabilidade com orçamento e
            regras oficiais.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/generate" className={buttonStyles("primary", "md")}>
              Montar estratégia
            </Link>
            <Link href="/stats" className={buttonStyles("ghost", "md")}>
              Ver estatísticas
            </Link>
          </div>
          <dl className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {homeData.highlights.map((item) => (
              <div
                key={item.label}
                className="min-h-[168px] rounded-2xl border border-white/20 bg-white/70 p-6 shadow-soft backdrop-blur dark:border-white/5 dark:bg-white/10"
              >
                <dt className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {item.label}
                </dt>
                <dd className="mt-3 text-2xl font-semibold tracking-tightest text-slate-900 dark:text-white">
                  {item.value}
                </dd>
                <p className="mt-1 text-sm tracking-tight text-slate-500 dark:text-slate-300">
                  {item.description}
                </p>
              </div>
            ))}
          </dl>
        </div>
        <aside className="flex flex-col gap-5">
          <Card className="rounded-3xl border border-white/15 bg-white/80 dark:border-white/10 dark:bg-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                Números em destaque
              </CardTitle>
              <CardDescription>
                Janela analisada: {homeData.windowSize} concursos recentes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <ul className="space-y-3">
                {homeData.topNumbers.map((numero) => (
                  <li
                    key={numero.dezena}
                    className="flex items-center gap-3 rounded-2xl border border-white/30 bg-white px-4 py-3 shadow-soft dark:border-white/5 dark:bg-white/5"
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm font-semibold text-white">
                      {numero.dezena.toString().padStart(2, "0")}
                    </span>
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {numberFormatter.format(numero.hits)} ocorrências
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {(numero.frequency * 100).toFixed(1)}% dos concursos
                        {numero.contestsSinceLast !== null
                          ? ` · há ${numero.contestsSinceLast} concursos sem sair`
                          : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="h-full rounded-3xl border border-white/15 bg-white/80 dark:border-white/10 dark:bg-white/10">
            <CardHeader>
              <CardTitle>Fases do roadmap</CardTitle>
              <CardDescription>
                Acompanhe o progresso planejado e garanta que cada etapa seja
                concluída com critérios claros.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <ul className="space-y-2">
                <li>✅ Fundamentos do projeto</li>
                <li>🛠️ Persistência &amp; ingestão de dados</li>
                <li>📊 Estatísticas &amp; dashboards</li>
                <li>🎯 Motor de apostas</li>
                <li>🚀 Automação &amp; entrega</li>
              </ul>
            </CardContent>
            <CardFooter className="justify-end pt-0">
              <Link href="/docs" className={buttonStyles("secondary", "md")}>
                Ver plano detalhado
              </Link>
            </CardFooter>
          </Card>
        </aside>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {workflow.map((item) => (
          <Card
            key={item.title}
            className="rounded-3xl border border-white/15 bg-white/80 dark:border-white/10 dark:bg-white/10"
          >
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900 px-6 py-9 text-white shadow-soft sm:px-8 dark:border-white/10 dark:bg-slate-950">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tightest sm:text-3xl">
              Pronto para construir colaborativamente?
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/70">
              Consulte o plano iterativo, abra um issue para reservar uma fase e
              reporte evidências de testes em cada PR. A transparência e a
              responsabilidade são pilares deste projeto.
            </p>
          </div>
          <Link
            href="/bets"
            className={buttonStyles(
              "secondary",
              "md",
              "bg-white text-slate-900 hover:bg-white/90",
            )}
          >
            Ver histórico de apostas
          </Link>
        </div>
      </section>
    </div>
  );
}
