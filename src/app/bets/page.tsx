import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button-variants";
import { EmptyState } from "@/components/ui/empty-state";
import { Stack } from "@/components/ui/stack";
import { HistoryTicketsGrid } from "@/components/bets/tickets-grid";
import { listBets } from "@/services/bet-store";
import type { StrategyMetadata } from "@/services/strategies/types";

type BetsPageProps = {
  searchParams?: Record<string, string | string[]>;
};

const STRATEGY_OPTIONS = [
  { value: "", label: "Todas as estratégias" },
  { value: "balanced", label: "Balanceada" },
  { value: "uniform", label: "Distribuição uniforme" },
  { value: "hot-streak", label: "Hot Streak" },
  { value: "cold-surge", label: "Cold Surge" },
] as const;

const STRATEGY_LABEL = STRATEGY_OPTIONS.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {},
);

export default async function BetsPage({ searchParams }: BetsPageProps) {
  const params = normalizeFilters(searchParams);
  const bets = await listBets({
    strategy: params.strategy,
    createdFrom: params.fromDate ?? undefined,
    createdTo: params.toDate ?? undefined,
    limit: 40,
  });

  const filtersSummary = describeFilters(params);
  const hasFilters = filtersSummary !== null;
  const gridRows = bets.map((bet) => {
    const metadata = bet.payload.ticket?.metadata as
      | Partial<StrategyMetadata>
      | undefined;
    const score =
      typeof metadata?.score === "number" ? metadata.score : undefined;

    return {
      id: bet.id,
      dezenas: bet.dezenas,
      strategy: bet.strategyName,
      budgetCents: bet.budgetCents,
      totalCostCents: bet.totalCostCents,
      ticketCostCents: bet.ticketCostCents,
      createdAtIso: bet.createdAt.toISOString(),
      ticketsGenerated: bet.payload.ticketsGenerated,
      batchSeed: bet.payload.seed,
      ticketSeed: bet.payload.ticket?.seed ?? bet.payload.seed,
      metadata: metadata ?? null,
      score,
      window: bet.payload.config?.window ?? null,
    };
  });

  return (
    <Stack gap="lg">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Histórico de apostas e auditoria
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Consulte os lotes gerados com o motor Stage 5, incluindo orçamento
          aplicado, estratégia executada e seed utilizada para reprodução.
        </p>
        {hasFilters && (
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Filtros ativos: {filtersSummary}
          </p>
        )}
      </header>

      <Filters initial={params} />

      {bets.length === 0 ? (
        <EmptyState
          title="Nenhum lote gerado ainda"
          description="Utilize o gerador de apostas para registrar combinações auditáveis com seed e metadados completos."
          action={{ label: "Abrir gerador", href: "/generate" }}
        />
      ) : (
        <HistoryTicketsGrid rows={gridRows} />
      )}

      <Card className="border border-brand-500/30 bg-brand-500/10">
        <CardHeader>
          <CardTitle>Precisa auditar um lote?</CardTitle>
          <CardDescription>
            Abra os detalhes para exportar o payload, anexar ao concurso
            correspondente ou repetir a geração via seed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
          <Link href="/generate" className={buttonStyles("primary")}>
            Gerar novo lote
          </Link>
          <span>
            Consulte também `docs/API_BET_ENGINE.md` para integrações
            programáticas e scripts de auditoria.
          </span>
        </CardContent>
      </Card>
    </Stack>
  );
}

function normalizeFilters(searchParams?: Record<string, string | string[]>) {
  const single = (key: string) => {
    const value = searchParams?.[key];
    if (Array.isArray(value)) return value[0];
    return value ?? "";
  };

  const strategy = single("strategy").toLowerCase();
  const fromRaw = single("from");
  const toRaw = single("to");

  const fromDate = parseISODate(fromRaw);
  const toDate = endOfDay(parseISODate(toRaw));

  return {
    strategy: strategy || undefined,
    from: fromRaw,
    to: toRaw,
    fromDate,
    toDate,
  };
}

function parseISODate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function endOfDay(date: Date | null) {
  if (!date) return null;
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function describeFilters(filters: ReturnType<typeof normalizeFilters>) {
  const parts: string[] = [];
  if (filters.strategy) {
    const label = STRATEGY_LABEL[filters.strategy] ?? filters.strategy;
    parts.push(`Estratégia ${label}`);
  }
  if (filters.from) {
    parts.push(`De ${filters.from}`);
  }
  if (filters.to) {
    parts.push(`Até ${filters.to}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join(" · ");
}

function Filters({
  initial,
}: {
  initial: ReturnType<typeof normalizeFilters>;
}) {
  return (
    <form
      className="grid gap-4 rounded-3xl border border-white/20 bg-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-white/10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
      method="get"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            htmlFor="strategy"
          >
            Estratégia
          </label>
          <select
            id="strategy"
            name="strategy"
            defaultValue={initial.strategy ?? ""}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {STRATEGY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              htmlFor="from"
            >
              De
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={initial.from ?? ""}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              htmlFor="to"
            >
              Até
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={initial.to ?? ""}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonStyles("primary", "md")}>
          Aplicar filtros
        </button>
        {(initial.strategy || initial.from || initial.to) && (
          <Link href="/bets" className={buttonStyles("ghost", "md")}>
            Limpar
          </Link>
        )}
      </div>
    </form>
  );
}
