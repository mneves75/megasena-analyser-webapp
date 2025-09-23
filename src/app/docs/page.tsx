import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button-variants";

const REPO_BASE =
  "https://github.com/seu-usuario/megasena-analyser-nextjs/blob/main";

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Documentação e guias do projeto
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Utilize este hub para encontrar planos, prompts e notas de
          arquitetura. Todo o conteúdo oficial está versionado no diretório
          `docs/` do repositório.
        </p>
      </header>
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="bg-white/70 dark:bg-white/5">
          <CardHeader>
            <CardTitle>Plano de implementação</CardTitle>
            <CardDescription>
              Sequenciamento completo por fases, critérios de saída e
              indicadores de SLA.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <Link
              className="underline-offset-4 hover:underline"
              href={`${REPO_BASE}/docs/IMPLEMENTATION_PLAN.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir no GitHub
            </Link>
            <Link href="/" className={buttonStyles("secondary")}>
              Voltar ao início
            </Link>
          </CardContent>
        </Card>
        <Card className="bg-white/70 dark:bg-white/5">
          <CardHeader>
            <CardTitle>Prompt do agente</CardTitle>
            <CardDescription>
              Diretrizes detalhadas para agentes de código e cientistas de dados
              colaborarem no projeto.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <Link
              className="underline-offset-4 hover:underline"
              href={`${REPO_BASE}/docs/PROMPT%20MEGASENA%20APP.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir no GitHub
            </Link>
            <Link href="/generate" className={buttonStyles("ghost")}>
              Próximas tarefas
            </Link>
          </CardContent>
        </Card>
      </section>
      <Card className="bg-brand-500/12 border-brand-500/30">
        <CardHeader>
          <CardTitle>Contribua com melhorias</CardTitle>
          <CardDescription>
            Atualize os arquivos em `docs/` ao concluir uma fase. Inclua fontes
            oficiais, datas de consulta e passos de reprodução.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
