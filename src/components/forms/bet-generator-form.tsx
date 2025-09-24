"use client";

import * as React from "react";
import {
  ArrowPathIcon,
  CalculatorIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { generateBetsAction } from "@/app/generate/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonStyles } from "@/components/ui/button-variants";
import {
  GeneratedTicketsGrid,
  formatCurrency,
  formatTicketNumbers,
} from "@/components/bets/tickets-grid";

type GeneratedTicket = {
  strategy: string;
  dezenas: number[];
  metadata: Record<string, unknown>;
  costCents: number;
  seed: string;
};

type GenerationPayload = {
  totalCostCents: number;
  leftoverCents: number;
  requestedBudgetCents: number;
  ticketsGenerated: number;
  strategies: Array<{ name: string; generated: number }>;
  config: {
    k: number;
    strategies: Array<{ name: string; weight?: number }>;
  };
};

type FormState =
  | { status: "idle" }
  | {
      status: "error";
      errors: Record<string, string[]>;
      message?: string;
    }
  | {
      status: "success";
      tickets: GeneratedTicket[];
      payload: GenerationPayload;
      warnings: string[];
    };

const EMPTY_TICKETS: GeneratedTicket[] = [];

const strategies = [
  {
    value: "balanced",
    label: "Estratégia Balanceada",
    description:
      "Combina frequência, quadrantes e recência para maximizar cobertura estatística sem extrapolar orçamento.",
  },
  {
    value: "uniform",
    label: "Distribuição Uniforme",
    description:
      "Distribui dezenas uniformemente entre as faixas para servir como baseline auditável.",
  },
];

const budgetOptions = [
  { value: "5000", label: "R$ 50,00" },
  { value: "10000", label: "R$ 100,00" },
  { value: "20000", label: "R$ 200,00" },
  { value: "50000", label: "R$ 500,00" },
  { value: "100000", label: "R$ 1.000,00" },
  { value: "custom", label: "Valor personalizado" },
];

export function BetGeneratorForm() {
  const [state, formAction, isPending] = React.useActionState(actionHandler, {
    status: "idle",
  } as FormState);

  const formRef = React.useRef<HTMLFormElement>(null);
  const [budget, setBudget] = React.useState("10000");
  const [customBudget, setCustomBudget] = React.useState("");
  const [strategy, setStrategy] = React.useState("balanced");
  const [seed, setSeed] = React.useState(() => createSeed());
  const [windowValue, setWindowValue] = React.useState("200");
  const [copiedTicketIndex, setCopiedTicketIndex] = React.useState<
    number | null
  >(null);
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const selectedStrategy = React.useMemo(
    () => strategies.find((item) => item.value === strategy),
    [strategy],
  );

  const isCustomBudget = budget === "custom";
  const parsedCustomBudget = Number.parseFloat(customBudget.replace(",", "."));
  const budgetCents = isCustomBudget
    ? Number.isFinite(parsedCustomBudget)
      ? Math.round(parsedCustomBudget * 100)
      : 0
    : Number.parseInt(budget, 10);

  const fieldErrors = state.status === "error" ? state.errors : {};
  const generalError = state.status === "error" ? state.message : null;
  const tickets = state.status === "success" ? state.tickets : EMPTY_TICKETS;
  const payload = state.status === "success" ? state.payload : null;
  const warnings = state.status === "success" ? state.warnings : [];
  const ticketsAsText =
    tickets.length > 0
      ? tickets.map((ticket) => formatTicketNumbers(ticket.dezenas)).join("\n")
      : "";
  const copyToClipboard = React.useCallback(
    async (text: string, onSuccess: () => void) => {
      try {
        if (
          typeof navigator === "undefined" ||
          !navigator.clipboard?.writeText
        ) {
          throw new Error("clipboard-unavailable");
        }
        await navigator.clipboard.writeText(text);
        setCopyError(null);
        onSuccess();
      } catch (error) {
        console.error("copy-to-clipboard", error);
        setCopyError(
          "Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.",
        );
        window.setTimeout(() => setCopyError(null), 4000);
      }
    },
    [setCopyError],
  );
  const handleCopyTicket = React.useCallback(
    (index: number, text: string) => {
      copyToClipboard(text, () => {
        setCopiedTicketIndex(index);
        setCopiedAll(false);
        window.setTimeout(() => setCopiedTicketIndex(null), 2000);
      });
    },
    [copyToClipboard],
  );
  const handleCopyAll = React.useCallback(() => {
    if (tickets.length === 0 || ticketsAsText.length === 0) {
      return;
    }
    copyToClipboard(ticketsAsText, () => {
      setCopiedAll(true);
      setCopiedTicketIndex(null);
      window.setTimeout(() => setCopiedAll(false), 2000);
    });
  }, [copyToClipboard, tickets.length, ticketsAsText]);

  const disableSubmit = isPending || budgetCents < 600;
  const totalCost = payload?.totalCostCents ?? 0;
  const leftover = payload?.leftoverCents ?? 0;
  const budgetDisplay = formatCurrency(
    payload?.requestedBudgetCents ?? budgetCents,
  );
  const totalCostDisplay = formatCurrency(totalCost);
  const leftoverDisplay = formatCurrency(leftover);

  return (
    <div className="space-y-12">
      <form ref={formRef} action={formAction} className="space-y-8">
        <input
          type="hidden"
          name="budgetCents"
          value={budgetCents > 0 ? budgetCents : ""}
        />
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalculatorIcon className="h-5 w-5" />
              Configuração da estratégia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <Select
                  name="strategy"
                  label="Estratégia"
                  value={strategy}
                  onChange={(event) => setStrategy(event.target.value)}
                  options={strategies}
                  helperText="Escolha como as dezenas serão priorizadas"
                  error={fieldErrors.strategy?.[0]}
                />

                {selectedStrategy && (
                  <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/50">
                    <h4 className="mb-1 text-sm font-medium text-slate-900 dark:text-white">
                      {selectedStrategy.label}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {selectedStrategy.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Select
                  label="Orçamento"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  options={budgetOptions}
                  helperText="Valores em reais (mínimo R$ 6,00)"
                  error={fieldErrors.budgetCents?.[0]}
                />

                {isCustomBudget && (
                  <Input
                    label="Valor personalizado"
                    name="budgetCustom"
                    type="number"
                    min="6"
                    step="0.01"
                    value={customBudget}
                    onChange={(event) => setCustomBudget(event.target.value)}
                    leftIcon={<CurrencyDollarIcon className="h-4 w-4" />}
                    placeholder="0,00"
                    helperText="Digite o valor em reais"
                    error={fieldErrors.budgetCents?.[0]}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Input
                className="h-12"
                label="Seed (reprodutibilidade)"
                name="seed"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                helperText="Use uma seed para recriar exatamente este conjunto de apostas"
                error={fieldErrors.seed?.[0]}
                rightIcon={
                  <button
                    type="button"
                    className="text-brand-500 transition hover:text-brand-600"
                    onClick={() => setSeed(createSeed())}
                    aria-label="Gerar nova seed"
                  >
                    <ArrowPathIcon className="h-5 w-5" />
                  </button>
                }
              />
              <Input
                className="h-12"
                label="Janela de análise (concursos)"
                name="window"
                type="number"
                min="30"
                step="10"
                value={windowValue}
                onChange={(event) => setWindowValue(event.target.value)}
                helperText="Opcional — restringe frequência/recência aos concursos mais recentes"
                error={fieldErrors.window?.[0]}
              />
            </div>

            <div className="flex flex-col gap-4 rounded-2xl bg-brand-50 p-5 dark:bg-brand-900/10 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Orçamento selecionado
                </p>
                <p className="text-2xl font-semibold text-brand-600 dark:text-brand-400">
                  {formatCurrency(budgetCents)}
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                {state.status === "error" && (
                  <Badge
                    variant="warning"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    {generalError ?? "Revise os campos"}
                  </Badge>
                )}
                <Button
                  type="submit"
                  size="lg"
                  disabled={disableSubmit}
                  className="min-w-[200px]"
                >
                  {isPending ? "Gerando apostas..." : "Gerar apostas"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {isPending && (
        <Card className="mx-auto max-w-4xl">
          <CardContent className="py-12">
            <div className="space-y-4 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/20">
                <CalculatorIcon className="h-8 w-8 animate-spin text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Calculando combinações ideais…
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Validando limites, removendo duplicatas e aplicando{" "}
                  {selectedStrategy?.label.toLowerCase()}.
                </p>
              </div>
              <Progress value={65} className="mx-auto max-w-xs" />
            </div>
          </CardContent>
        </Card>
      )}

      {!isPending && state.status === "success" && (
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultados da geração</span>
              <Badge
                variant="success"
                size="sm"
                className="flex items-center gap-1"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {tickets.length} apostas
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <GeneratedTicketsGrid
              tickets={tickets}
              copiedTicketIndex={copiedTicketIndex}
              onCopyTicket={handleCopyTicket}
            />

            <div className="grid gap-4 rounded-2xl bg-brand-50 p-5 text-sm text-slate-700 dark:bg-brand-900/10 dark:text-slate-300 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  Orçamento processado
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {budgetDisplay}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  Custo total gerado
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {totalCostDisplay}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  Saldo remanescente
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {leftoverDisplay}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={buttonStyles("primary")}
                onClick={() => formRef.current?.requestSubmit()}
              >
                Gerar novamente
              </button>
              <button
                type="button"
                onClick={() => downloadPayload(payload!, tickets, warnings)}
                className={buttonStyles("secondary")}
              >
                <CloudArrowDownIcon className="mr-2 h-4 w-4" /> Exportar payload
                JSON
              </button>
              <button
                type="button"
                onClick={handleCopyAll}
                className={buttonStyles(
                  "ghost",
                  "md",
                  "gap-2 text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300",
                )}
                disabled={tickets.length === 0}
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
                {copiedAll ? "Tudo copiado" : "Copiar todas"}
              </button>
              <LinkButton href="/bets">Ver histórico atualizado</LinkButton>
            </div>

            {copyError && (
              <Badge
                variant="warning"
                size="sm"
                className="flex items-center gap-1"
              >
                <ExclamationTriangleIcon className="h-4 w-4" />
                {copyError}
              </Badge>
            )}

            {warnings.length > 0 && (
              <div className="rounded-2xl border border-yellow-300/40 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-900/20 dark:text-yellow-200">
                <p className="font-medium">Avisos da geração</p>
                <ul className="mt-2 space-y-1">
                  {warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isPending && state.status !== "success" && (
        <EmptyState
          title="Configure a estratégia para gerar apostas"
          description="Defina orçamento, seed e janela para receber combinações otimizadas com auditoria completa."
          icon={<CalculatorIcon className="h-12 w-12 text-brand-500" />}
        />
      )}
    </div>
  );
}

async function actionHandler(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await generateBetsAction(formData);
  if (!result.success) {
    return {
      status: "error",
      errors: result.errors ?? {},
      message: result.message,
    };
  }

  return {
    status: "success",
    tickets: result.tickets as GeneratedTicket[],
    payload: result.payload as GenerationPayload,
    warnings: result.warnings ?? [],
  };
}

function createSeed() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function downloadPayload(
  payload: GenerationPayload,
  tickets: GeneratedTicket[],
  warnings: string[],
) {
  const data = {
    generatedAt: new Date().toISOString(),
    payload,
    tickets,
    warnings,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bets-${payload.config.k}d-${payload.ticketsGenerated}-tickets.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function LinkButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonStyles("ghost")}>
      {children}
    </Link>
  );
}
