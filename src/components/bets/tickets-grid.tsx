"use client";

import * as React from "react";
import {
  CalendarDaysIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { DataGrid, type Column } from "react-data-grid";
import "react-data-grid/lib/styles.css";

import { buttonStyles } from "@/components/ui/button-variants";
import { CopySeedButton } from "@/components/bets/copy-seed-button";
import type {
  StrategyMetadata,
  ParityDistribution,
} from "@/services/strategies/types";

export type GeneratedTicketLike = {
  strategy: string;
  dezenas: number[];
  metadata: Record<string, unknown> | null | undefined;
  costCents: number;
  seed: string;
};

export function formatTicketNumbers(numbers: number[]) {
  return numbers.map((value) => value.toString().padStart(2, "0")).join(" ");
}

export function formatCurrency(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value / 100);
}

export type TicketMetadataDetailsProps = {
  seed: string;
  metadata: Record<string, unknown> | null | undefined;
  score?: number;
};

export function TicketMetadataDetails({
  seed,
  metadata,
  score,
}: TicketMetadataDetailsProps) {
  const resolvedMetadata = metadata as Partial<StrategyMetadata> | undefined;
  const parity = resolvedMetadata?.parity as ParityDistribution | undefined;
  const quadrants = Array.isArray(resolvedMetadata?.quadrants)
    ? resolvedMetadata?.quadrants
    : undefined;
  const sum =
    typeof resolvedMetadata?.sum === "number"
      ? resolvedMetadata.sum
      : undefined;
  const effectiveScore =
    typeof score === "number"
      ? score
      : typeof resolvedMetadata?.score === "number"
        ? resolvedMetadata.score
        : undefined;
  const detailsAvailable =
    sum !== undefined ||
    Boolean(parity) ||
    (quadrants && quadrants.length > 0) ||
    effectiveScore !== undefined;

  if (!detailsAvailable) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  return (
    <details className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-700/50 dark:bg-slate-900/30 dark:text-slate-400">
      <summary className="cursor-pointer list-none text-slate-500 transition hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100">
        Ver metadados
      </summary>
      <div className="mt-2 space-y-1">
        <p>
          <span className="font-medium text-slate-600 dark:text-slate-200">
            Seed derivada:
          </span>{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-900/60">
            {seed}
          </code>
        </p>
        {sum !== undefined && (
          <p>
            <span className="font-medium text-slate-600 dark:text-slate-200">
              Soma:
            </span>{" "}
            {sum}
          </p>
        )}
        {parity && (
          <p>
            <span className="font-medium text-slate-600 dark:text-slate-200">
              Paridade:
            </span>{" "}
            {parity.even} pares · {parity.odd} ímpares
          </p>
        )}
        {quadrants && quadrants.length > 0 && (
          <p>
            <span className="font-medium text-slate-600 dark:text-slate-200">
              Quadrantes:
            </span>{" "}
            {quadrants
              .map((entry) => `${entry.range}: ${entry.count}`)
              .join(" · ")}
          </p>
        )}
        {effectiveScore !== undefined && (
          <p>
            <span className="font-medium text-slate-600 dark:text-slate-200">
              Score:
            </span>{" "}
            {effectiveScore.toFixed(2)}
          </p>
        )}
      </div>
    </details>
  );
}

export type GeneratedTicketsGridProps = {
  tickets: GeneratedTicketLike[];
  copiedTicketIndex: number | null;
  onCopyTicket: (ticketIndex: number, dezenasText: string) => void;
};

export function GeneratedTicketsGrid({
  tickets,
  copiedTicketIndex,
  onCopyTicket,
}: GeneratedTicketsGridProps) {
  const rows = React.useMemo(() => {
    return tickets.map((ticket, index) => ({
      id: `${ticket.seed}-${index}`,
      displayIndex: index + 1,
      ticketIndex: index,
      dezenasText: formatTicketNumbers(ticket.dezenas),
      strategy: ticket.strategy,
      seed: ticket.seed,
      costCents: ticket.costCents,
      metadata: ticket.metadata,
    }));
  }, [tickets]);

  const gridHeight = React.useMemo(() => {
    const visibleRows = Math.min(rows.length, 8);
    const headerHeight = 44;
    const rowHeight = 48;
    return headerHeight + visibleRows * rowHeight + 2;
  }, [rows.length]);

  const rowKeyGetter = React.useCallback(
    (row: (typeof rows)[number]) => row.id,
    [],
  );

  const columns = React.useMemo<Column<(typeof rows)[number]>[]>(
    () => [
      {
        key: "displayIndex",
        name: "#",
        width: 50,
        resizable: false,
        renderCell: ({ row }) => (
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-300">
            {row.displayIndex}
          </span>
        ),
      },
      {
        key: "dezenasText",
        name: "Dezenas",
        minWidth: 220,
        renderCell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="select-text font-mono text-sm tracking-tight text-slate-900 dark:text-slate-100">
              {row.dezenasText}
            </span>
            <button
              type="button"
              className={buttonStyles(
                "ghost",
                "sm",
                "gap-1 text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300",
              )}
              onClick={() => onCopyTicket(row.ticketIndex, row.dezenasText)}
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
              {copiedTicketIndex === row.ticketIndex ? "Copiado" : "Copiar"}
            </button>
          </div>
        ),
      },
      {
        key: "strategy",
        name: "Estratégia",
        minWidth: 140,
        renderCell: ({ row }) => (
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
            {row.strategy}
          </span>
        ),
      },
      {
        key: "seed",
        name: "Seed",
        minWidth: 160,
        renderCell: ({ row }) => (
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-900/60 dark:text-slate-200">
            {row.seed.length > 10 ? `${row.seed.slice(0, 10)}…` : row.seed}
          </code>
        ),
      },
      {
        key: "cost",
        name: "Custo",
        width: 120,
        resizable: false,
        renderCell: ({ row }) => (
          <span className="block text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
            {formatCurrency(row.costCents)}
          </span>
        ),
      },
      {
        key: "metadata",
        name: "Metadados",
        minWidth: 200,
        renderCell: ({ row }) => (
          <TicketMetadataDetails seed={row.seed} metadata={row.metadata} />
        ),
      },
    ],
    [copiedTicketIndex, onCopyTicket],
  );

  const gridStyle = React.useMemo(
    () =>
      ({
        blockSize: `${gridHeight}px`,
        border: "none",
        "--rdg-background-color": "transparent",
        "--rdg-color": "currentColor",
        "--rdg-header-background-color": "rgba(148, 163, 184, 0.18)",
        "--rdg-header-color": "currentColor",
        "--rdg-row-hover-background-color": "rgba(14, 116, 144, 0.08)",
        "--rdg-row-selected-background-color": "rgba(14, 116, 144, 0.14)",
        "--rdg-border-color": "rgba(148, 163, 184, 0.35)",
        "--rdg-font-size": "0.875rem",
      }) as React.CSSProperties,
    [gridHeight],
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 text-sm text-slate-600 shadow-soft dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-300">
        Nenhuma aposta foi emitida para este orçamento.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 text-slate-900 shadow-soft dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-100">
      <DataGrid
        className="rdg-generated-bets [&_.rdg-cell]:whitespace-normal [&_.rdg-cell]:align-top [&_.rdg-cell]:py-3"
        columns={columns}
        rows={rows}
        rowKeyGetter={rowKeyGetter}
        rowHeight={48}
        headerRowHeight={44}
        defaultColumnOptions={{ resizable: true }}
        style={gridStyle}
      />
    </div>
  );
}

export type HistoryTicketRow = {
  id: string;
  dezenas: number[];
  strategy: string;
  budgetCents: number;
  totalCostCents: number;
  createdAtIso: string;
  ticketsGenerated: number;
  batchSeed: string;
  ticketSeed?: string | null;
  metadata: Record<string, unknown> | null | undefined;
  score?: number;
  window?: number | null;
};

const historyDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type HistoryTicketsGridProps = {
  rows: HistoryTicketRow[];
};

export function HistoryTicketsGrid({ rows }: HistoryTicketsGridProps) {
  const [copiedTicketIndex, setCopiedTicketIndex] = React.useState<
    number | null
  >(null);
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | null>(null);

  const enhancedRows = React.useMemo(() => {
    return rows.map((row, index) => ({
      ...row,
      displayIndex: index + 1,
      dezenasText: formatTicketNumbers(row.dezenas),
      createdAtLabel: historyDateFormatter.format(new Date(row.createdAtIso)),
    }));
  }, [rows]);

  const gridHeight = React.useMemo(() => {
    const visibleRows = Math.min(enhancedRows.length, 10);
    const headerHeight = 44;
    const rowHeight = 52;
    return headerHeight + visibleRows * rowHeight + 2;
  }, [enhancedRows.length]);

  const rowKeyGetter = React.useCallback(
    (row: (typeof enhancedRows)[number]) => row.id,
    [],
  );

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
        console.error("copy-history", error);
        setCopyError(
          "Falha ao copiar automaticamente. Selecione o texto e copie manualmente.",
        );
        window.setTimeout(() => setCopyError(null), 4000);
      }
    },
    [],
  );

  const handleCopyTicket = React.useCallback(
    (rowIndex: number, dezenasText: string) => {
      copyToClipboard(dezenasText, () => {
        setCopiedTicketIndex(rowIndex);
        setCopiedAll(false);
        window.setTimeout(() => setCopiedTicketIndex(null), 2000);
      });
    },
    [copyToClipboard],
  );

  const handleCopyAll = React.useCallback(() => {
    const concatenated = enhancedRows.map((row) => row.dezenasText).join("\n");
    if (!concatenated) {
      return;
    }
    copyToClipboard(concatenated, () => {
      setCopiedAll(true);
      setCopiedTicketIndex(null);
      window.setTimeout(() => setCopiedAll(false), 2000);
    });
  }, [copyToClipboard, enhancedRows]);

  const columns = React.useMemo<Column<(typeof enhancedRows)[number]>[]>(
    () => [
      {
        key: "displayIndex",
        name: "#",
        width: 48,
        resizable: false,
        renderCell: ({ row }) => (
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-300">
            {row.displayIndex}
          </span>
        ),
      },
      {
        key: "createdAtLabel",
        name: "Criada em",
        minWidth: 170,
        renderCell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-300">
            <CalendarDaysIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            {row.createdAtLabel}
          </span>
        ),
      },
      {
        key: "dezenasText",
        name: "Dezenas",
        minWidth: 220,
        renderCell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="select-text font-mono text-sm tracking-tight text-slate-900 dark:text-slate-100">
              {row.dezenasText}
            </span>
            <button
              type="button"
              className={buttonStyles(
                "ghost",
                "sm",
                "gap-1 text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300",
              )}
              onClick={() =>
                handleCopyTicket(row.displayIndex - 1, row.dezenasText)
              }
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
              {copiedTicketIndex === row.displayIndex - 1
                ? "Copiado"
                : "Copiar"}
            </button>
          </div>
        ),
      },
      {
        key: "strategy",
        name: "Estratégia",
        minWidth: 120,
        renderCell: ({ row }) => (
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
            {row.strategy}
          </span>
        ),
      },
      {
        key: "budgetCents",
        name: "Orçamento",
        width: 120,
        renderCell: ({ row }) => (
          <span className="block text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
            {formatCurrency(row.budgetCents)}
          </span>
        ),
      },
      {
        key: "totalCostCents",
        name: "Custo",
        width: 110,
        renderCell: ({ row }) => (
          <span className="block text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
            {formatCurrency(row.totalCostCents)}
          </span>
        ),
      },
      {
        key: "ticketsGenerated",
        name: "Tickets",
        width: 90,
        renderCell: ({ row }) => (
          <span className="block text-center text-sm font-medium text-slate-600 dark:text-slate-300">
            {row.ticketsGenerated}
          </span>
        ),
      },
      {
        key: "window",
        name: "Janela",
        width: 90,
        renderCell: ({ row }) => (
          <span className="block text-center text-sm text-slate-500 dark:text-slate-300">
            {row.window ?? "—"}
          </span>
        ),
      },
      {
        key: "batchSeed",
        name: "Seed",
        minWidth: 150,
        renderCell: ({ row }) => <CopySeedButton seed={row.batchSeed} />,
      },
      {
        key: "metadata",
        name: "Metadados",
        minWidth: 220,
        renderCell: ({ row }) => (
          <TicketMetadataDetails
            seed={row.ticketSeed ?? row.batchSeed}
            metadata={row.metadata}
            score={row.score}
          />
        ),
      },
    ],
    [copiedTicketIndex, handleCopyTicket],
  );

  const gridStyle = React.useMemo(
    () =>
      ({
        blockSize: `${gridHeight}px`,
        border: "none",
        "--rdg-background-color": "transparent",
        "--rdg-color": "currentColor",
        "--rdg-header-background-color": "rgba(148, 163, 184, 0.18)",
        "--rdg-header-color": "currentColor",
        "--rdg-row-hover-background-color": "rgba(14, 116, 144, 0.08)",
        "--rdg-row-selected-background-color": "rgba(14, 116, 144, 0.14)",
        "--rdg-border-color": "rgba(148, 163, 184, 0.35)",
        "--rdg-font-size": "0.875rem",
      }) as React.CSSProperties,
    [gridHeight],
  );

  if (enhancedRows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 text-sm text-slate-600 shadow-soft dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-300">
        Nenhuma aposta encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={buttonStyles(
            "ghost",
            "sm",
            "gap-2 text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300",
          )}
          onClick={handleCopyAll}
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          {copiedAll ? "Todas copiadas" : "Copiar todas"}
        </button>
        {copyError && (
          <span className="text-xs text-yellow-700 dark:text-yellow-300">
            {copyError}
          </span>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 text-slate-900 shadow-soft dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-100">
        <DataGrid
          className="rdg-generated-bets [&_.rdg-cell]:whitespace-normal [&_.rdg-cell]:align-top [&_.rdg-cell]:py-3"
          rows={enhancedRows}
          columns={columns}
          rowKeyGetter={rowKeyGetter}
          rowHeight={52}
          headerRowHeight={44}
          defaultColumnOptions={{ resizable: true }}
          style={gridStyle}
        />
      </div>
    </div>
  );
}
