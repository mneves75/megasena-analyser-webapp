import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button-variants";

const roadmap = [
  {
    title: "Histórico auditável",
    description:
      "Armazenar cada aposta gerada com orçamento, estratégia, seed e carimbo de data/hora para auditoria.",
  },
  {
    title: "Exportações sob demanda",
    description:
      "Permitir download em CSV/PDF e registrar logs de exportação conforme requisitos do plano.",
  },
  {
    title: "Insights acionáveis",
    description:
      "Exibir métricas como cobertura esperada, custo médio e distribuição por faixa em cada conjunto de apostas.",
  },
];

export default function BetsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Histórico de apostas e auditoria
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          A área exibirá apostas geradas, com filtros por estratégia, orçamento
          e data. Use este espaço para registrar requisitos e alinhar
          expectativas com o time.
        </p>
      </header>
      <section className="grid gap-6 md:grid-cols-3">
        {roadmap.map((item) => (
          <Card key={item.title} className="bg-white/70 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
      <Card className="border-brand-500/30 bg-brand-500/10">
        <CardHeader>
          <CardTitle>Progresso próximo</CardTitle>
          <CardDescription>
            Após implementar o motor de apostas, conecte o salvamento em `bets`
            e alimente este dashboard com dados reais.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <Link href="/generate" className={buttonStyles("primary")}>
            Gerar apostas
          </Link>
          <span>
            Documente no PR os cenários de teste manuais e links para
            exportações produzidas.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
