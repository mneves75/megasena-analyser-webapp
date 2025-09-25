"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { buttonStyles } from "@/components/ui/button-variants";
import type { GeneratedTicketLike } from "@/components/bets/tickets-grid";
import {
  formatCurrency,
  formatTicketNumbers,
} from "@/components/bets/tickets-grid";
import { getStrategyLabel } from "@/services/strategies/labels";
import type { StrategyMetadata } from "@/services/strategies/types";

export type TicketMetadataDialogProps = {
  open: boolean;
  ticket: GeneratedTicketLike | null;
  onClose: () => void;
};

export function TicketMetadataDialog({
  open,
  ticket,
  onClose,
}: TicketMetadataDialogProps) {
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      setPortalNode(document.body);
    }
  }, []);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !portalNode || !ticket) {
    return null;
  }

  const resolvedMetadata = ticket.metadata as
    | Partial<StrategyMetadata>
    | undefined;
  const sum =
    typeof resolvedMetadata?.sum === "number"
      ? resolvedMetadata.sum
      : undefined;
  const parity = resolvedMetadata?.parity;
  const quadrants = Array.isArray(resolvedMetadata?.quadrants)
    ? resolvedMetadata?.quadrants
    : undefined;
  const score =
    typeof resolvedMetadata?.score === "number"
      ? resolvedMetadata.score
      : undefined;
  const strategyLabel = getStrategyLabel(ticket.strategy);

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl rounded-3xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
              Detalhes da aposta
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {strategyLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={buttonStyles(
              "ghost",
              "sm",
              "text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
            )}
          >
            Fechar
          </button>
        </header>
        <div className="space-y-6 px-6 py-6 text-sm leading-relaxed">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Dezenas
                </dt>
                <dd className="mt-1 font-mono text-base text-slate-900 dark:text-slate-100">
                  {formatTicketNumbers(ticket.dezenas)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Semente
                </dt>
                <dd className="mt-1 font-mono text-base text-slate-900 dark:text-slate-100">
                  {ticket.seed}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Custo da aposta
                </dt>
                <dd className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(ticket.costCents)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Estratégia (id)
                </dt>
                <dd className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                  {ticket.strategy}
                </dd>
              </div>
            </dl>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white/60 px-5 py-4 text-sm text-slate-700 dark:border-slate-700/40 dark:bg-slate-900/40 dark:text-slate-200">
            <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              Metadados calculados
            </h3>
            <ul className="mt-3 space-y-2">
              {sum !== undefined ? (
                <li>
                  <span className="font-medium text-slate-600 dark:text-slate-100">
                    Soma das dezenas:
                  </span>{" "}
                  {sum}
                </li>
              ) : null}
              {parity ? (
                <li>
                  <span className="font-medium text-slate-600 dark:text-slate-100">
                    Paridade:
                  </span>{" "}
                  {parity.even} pares · {parity.odd} ímpares
                </li>
              ) : null}
              {quadrants && quadrants.length > 0 ? (
                <li>
                  <span className="font-medium text-slate-600 dark:text-slate-100">
                    Quadrantes:
                  </span>{" "}
                  {quadrants
                    .map((entry) => `${entry.range}: ${entry.count}`)
                    .join(" · ")}
                </li>
              ) : null}
              {score !== undefined ? (
                <li>
                  <span className="font-medium text-slate-600 dark:text-slate-100">
                    Pontuação da heurística:
                  </span>{" "}
                  {score.toFixed(2)}
                </li>
              ) : null}
              <li>
                <span className="font-medium text-slate-600 dark:text-slate-100">
                  Metadados brutos:
                </span>
                <pre className="mt-1 select-text overflow-x-auto rounded bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                  {JSON.stringify(resolvedMetadata ?? {}, null, 2)}
                </pre>
              </li>
            </ul>
          </section>
        </div>
        <footer className="flex justify-end border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            className={buttonStyles(
              "primary",
              "md",
              "px-6 text-sm font-semibold",
            )}
            onClick={onClose}
          >
            Entendi
          </button>
        </footer>
      </div>
    </div>,
    portalNode,
  );
}
