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

const statsHighlights = [
  {
    label: "Cobertura histórica",
    value: "+5.000 concursos",
    description:
      "Sincronize o banco local com todo o histórico oficial para análises confiáveis.",
  },
  {
    label: "Heurísticas configuráveis",
    value: "4 estratégias",
    description:
      "Combine distribuição histórica, pares quentes e diversificação por soma/recência.",
  },
  {
    label: "Qualidade garantida",
    value: "CI + testes",
    description:
      "Pipelines de lint, typecheck e suíte de testes para releases seguros.",
  },
];

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

export default function Home() {
  return (
    <div className="relative z-10 flex flex-col gap-12">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div data-card className="p-10">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">
            Projeto em construção guiada
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl sm:leading-tight dark:text-white">
            Inteligência estatística para cada aposta da Mega-Sena
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            Centralize ingestão de dados oficiais, análises históricas e geração
            de apostas otimizadas com uma experiência única. Construa em fases,
            valide cada release e mantenha responsabilidade com orçamento e
            regras oficiais.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/generate" className={buttonStyles("primary")}>
              Montar estratégia
            </Link>
            <Link href="/stats" className={buttonStyles("ghost")}>
              Ver estatísticas
            </Link>
          </div>
          <dl className="mt-10 grid gap-6 sm:grid-cols-3">
            {statsHighlights.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/30 bg-white/50 p-4 shadow-soft backdrop-blur-md dark:border-white/10 dark:bg-white/5"
              >
                <dt className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {item.label}
                </dt>
                <dd className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                  {item.value}
                </dd>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  {item.description}
                </p>
              </div>
            ))}
          </dl>
        </div>
        <aside className="flex flex-col gap-4">
          <Card className="h-full justify-between bg-gradient-to-br from-white/90 to-white/60 dark:from-white/10 dark:to-white/5">
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
            <CardFooter className="justify-end">
              <Link href="/docs" className={buttonStyles("secondary")}>
                Ver plano detalhado
              </Link>
            </CardFooter>
          </Card>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {workflow.map((item) => (
          <Card key={item.title} className="bg-white/65 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="rounded-2xl border border-white/20 bg-slate-900 px-8 py-10 text-white shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
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
