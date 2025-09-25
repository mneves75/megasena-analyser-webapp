import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button-variants";
import { BetGeneratorForm } from "@/components/forms/bet-generator-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Stack } from "@/components/ui/stack";

const checklist = [
  "Conectar tabela de preços oficiais e validar combinações permitidas",
  "Implementar estratégias (uniforme, balanceada, pares/trincas, recência/soma)",
  "Garantir solver determinístico com seed e orçamento máximo",
  "Persistir apostas em `bets` com metadados e auditoria",
];

export default function GeneratePage() {
  return (
    <Stack gap="lg">
      <Breadcrumb items={[{ label: "Gerar Apostas", current: true }]} />

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tightest text-slate-900 dark:text-white">
          Gerador de apostas otimizado
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Configure sua estratégia, defina o orçamento e gere apostas otimizadas
          baseadas em análises estatísticas avançadas.
        </p>
      </header>

      <BetGeneratorForm />
      <Card className="bg-white/70 dark:bg-white/5">
        <CardHeader>
          <CardTitle>Checklist técnico</CardTitle>
          <CardDescription>
            Cada item deve ser implementado com testes unitários e validações de
            negócio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <ul className="list-disc space-y-2 pl-6">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-brand-500/15 to-slate-900/80 text-white">
        <CardHeader>
          <CardTitle>Boas práticas</CardTitle>
          <CardDescription className="text-white/70">
            Garanta que cada estratégia reporte custo total, cobertura esperada
            e seed usada para reprodução.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4 text-sm text-white/80">
          <Link
            href="/bets"
            className={buttonStyles(
              "secondary",
              "md",
              "bg-white text-slate-900 hover:bg-white/90",
            )}
          >
            Ver histórico planejado
          </Link>
          <span>
            Leia também `docs/PROMPT MEGASENA APP.md` para restrições oficiais.
          </span>
        </CardContent>
      </Card>
    </Stack>
  );
}
