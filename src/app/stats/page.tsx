import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button-variants";

const sections = [
  {
    title: "Frequência e recência",
    description:
      "Visualize contagens históricas por dezena, janelas móveis e dias desde a última ocorrência.",
  },
  {
    title: "Pares, trincas e sequências",
    description:
      "Compare combinações mais recorrentes e filtre por janelas específicas para orientar cobertura.",
  },
  {
    title: "Distribuições avançadas",
    description:
      "Explore soma, paridade, quadrantes e gráficos de calor para calibrar estratégias.",
  },
];

const REPO_BASE =
  "https://github.com/seu-usuario/megasena-analyser-nextjs/blob/main";

export default function StatsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Estatísticas e insights históricos
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Esta área consolidará gráficos e indicadores alimentados pelas rotas
          `/api/stats/*`. Enquanto a implementação avança, utilize os cartões
          abaixo para acompanhar o escopo planejado.
        </p>
      </header>
      <section className="grid gap-6 md:grid-cols-3">
        {sections.map((item) => (
          <Card key={item.title} className="bg-white/70 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
      <Card className="bg-gradient-to-r from-brand-500/15 to-purple-500/20 dark:from-brand-500/10 dark:to-purple-500/15">
        <CardHeader>
          <CardTitle>Próximos passos</CardTitle>
          <CardDescription>
            Integre as rotas `/api/stats` ao frontend utilizando React Query ou
            SWR, inclua gráficos Chart.js e mantenha caches invalidando após o
            sync CAIXA.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
          <Link href="/docs" className={buttonStyles("primary")}>
            Revisar plano completo
          </Link>
          <span>
            Consulte o documento completo em
            <Link
              className="ml-1 underline-offset-4 hover:underline"
              href={`${REPO_BASE}/docs/IMPLEMENTATION_PLAN.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/IMPLEMENTATION_PLAN.md
            </Link>
            .
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
