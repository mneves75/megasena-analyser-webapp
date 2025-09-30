import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatList } from "@/components/dashboard/stat-list";
import { buttonStyles } from "@/components/ui/button-variants";
import { Stack } from "@/components/ui/stack";
import { loadHomeSummary } from "@/services/dashboard/home-summary";

export default async function Home() {
  const homeData = await loadHomeSummary();
  const showOnboardingBanner = homeData.totalDraws === 0;
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
    <Stack className="relative z-10" gap="xl">
      {showOnboardingBanner && (
        <Card
          variant="comfortable"
          className="border border-dashed border-brand-500/40 bg-brand-500/10 text-slate-900 dark:border-brand-400/30 dark:bg-brand-500/15 dark:text-white"
        >
          <CardHeader className="gap-3">
            <CardTitle className="text-xl font-semibold">
              Sincronize os concursos para liberar análises
            </CardTitle>
            <CardDescription className="text-sm text-slate-700 dark:text-white/70">
              Ainda não encontramos concursos no banco local. Rode{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-medium text-slate-900 dark:bg-white/10 dark:text-white">
                npm run sync -- --full --limit=4000
              </code>{" "}
              ou consulte o guia de instalação para popular os dados oficiais
              antes de explorar as estatísticas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/docs" className={buttonStyles("primary", "md")}>
              Abrir manual de instalação
            </Link>
            <Link href="/stats" className={buttonStyles("ghost", "md")}>
              Ver plano Stage 6
            </Link>
          </CardContent>
        </Card>
      )}

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
          <dl className="mt-12 grid gap-7 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {homeData.highlights.map((item) => (
              <div
                key={item.label}
                className="min-h-[176px] rounded-3xl border border-white/20 bg-white/80 p-7 shadow-soft backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-white/5 dark:bg-white/10"
              >
                <dt className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {item.label}
                </dt>
                <dd className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tightest text-slate-900 dark:text-white">
                  {item.value}
                </dd>
                <p className="mt-2 text-sm leading-relaxed tracking-tight text-slate-600 break-words text-balance dark:text-slate-300">
                  {item.description}
                </p>
              </div>
            ))}
          </dl>
        </div>
        <aside className="flex flex-col gap-5">
          <Card
            variant="comfortable"
            className="rounded-3xl border border-white/15 bg-white/85 dark:border-white/10 dark:bg-white/10"
          >
            <CardContent className="p-0">
              <div className="space-y-4 p-7">
                <StatList
                  title="Números em destaque"
                  description={`Janela analisada: ${homeData.windowSize} concursos`}
                  items={homeData.topNumbers}
                  badge={{ label: "Top 6", variant: "secondary" }}
                  accent="hot"
                />
              </div>
            </CardContent>
          </Card>
          <Card
            variant="compact"
            className="h-full rounded-3xl border border-white/15 bg-white/80 dark:border-white/10 dark:bg-white/10"
          >
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
            variant="compact"
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
    </Stack>
  );
}
