'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FactList, type Fact } from '@/app/_components/archive-ui';
import { BetRow } from './bet-row';
import { type BetGenerationResult } from '@/lib/analytics/bet-generator.types';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import { pt } from '@/lib/i18n';

interface BetListProps {
  result: BetGenerationResult;
  className?: string;
}

const BETS_PER_PAGE = 20;

export function BetList({ result, className }: BetListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  /**
   * CRITICAL: Pagination reset is handled via key prop in parent component.
   * When result changes, React remounts this component with key={resultId},
   * automatically resetting all state (including currentPage) to initial values.
   *
   * This follows React best practices from:
   * https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes
   *
   * Benefits over useEffect approach:
   * - Single render (no double render from effect)
   * - Clear intent (key prop signals "different data")
   * - No state synchronization bugs
   * - All component state resets atomically
   */

  const formatCurrencyValue = (val: number | null) => {
    if (val === null) return formatCurrency(0);
    return formatCurrency(val);
  };

  const formatPercentageValue = (val: number | null) => {
    return formatPercentage(val ?? 0, 1);
  };

  // Pagination calculations
  const totalPages = Math.ceil(result.bets.length / BETS_PER_PAGE);
  const startIndex = (currentPage - 1) * BETS_PER_PAGE;
  const endIndex = startIndex + BETS_PER_PAGE;
  const currentBets = result.bets.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  const summaryFacts: Fact[] = [
    { term: pt.betGenerator.summary.totalCost, value: formatCurrencyValue(result.totalCost) },
    {
      term: pt.betGenerator.summary.utilization,
      value: formatPercentageValue(result.budgetUtilization),
      ...(result.budgetUtilization !== null && result.budgetUtilization >= 95
        ? { hint: pt.betGenerator.summary.utilizationGreat }
        : {}),
    },
    { term: pt.betGenerator.summary.uniqueNumbers, value: result.totalNumbers },
    { term: pt.betGenerator.summary.remaining, value: formatCurrencyValue(result.remainingBudget) },
  ];

  return (
    <div className={cn('space-y-8', className)}>
      <section aria-labelledby="bets-summary" className="space-y-4">
        <div>
          <h2 id="bets-summary" className="text-2xl font-semibold sm:text-3xl">
            {pt.betGenerator.summary.title}
          </h2>
          <p className="mt-1 text-muted-foreground tabular-nums">
            {result.bets.length}{' '}
            {result.bets.length === 1
              ? pt.betGenerator.summary.generatedSingle
              : pt.betGenerator.summary.generatedPlural}
          </p>
        </div>
        <FactList facts={summaryFacts} />
        <p className="text-sm text-muted-foreground tabular-nums">
          {result.summary.simpleBets} {pt.betGenerator.summary.simpleLabel} ·{' '}
          {result.summary.multipleBets}{' '}
          {result.summary.multipleBets === 1
            ? pt.betGenerator.summary.multipleSingle
            : pt.betGenerator.summary.multiplePlural}{' '}
          · {pt.betGenerator.summary.average}: {formatCurrencyValue(result.summary.averageCost)}
        </p>
        {result.remainingBudget !== null && result.remainingBudget >= 6 ? (
          <p className="text-sm text-muted-foreground">
            {pt.betGenerator.summary.remainingTipPrefix}{' '}
            {formatCurrencyValue(result.remainingBudget)}{' '}
            {pt.betGenerator.summary.remainingTipSuffix}
          </p>
        ) : null}
      </section>

      <ol
        aria-labelledby="bets-summary"
        className="divide-y divide-border border-y-2 border-y-primary"
      >
        {currentBets.map((bet, index) => (
          <BetRow key={bet.id} bet={bet} index={startIndex + index} />
        ))}
      </ol>

      {totalPages > 1 && (
        <nav aria-label="Páginas de apostas" className="space-y-3">
          {/* Mobile: Anterior/Próxima share the first row and the page numbers take a
              full row, so the pager keeps one height on every page. */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              {pt.betGenerator.summary.previous}
            </Button>

            <div className="order-last flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first, last, current, and pages around current
                const showPage =
                  page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                if (!showPage && !showEllipsisBefore && !showEllipsisAfter) {
                  return null;
                }

                if (showEllipsisBefore || showEllipsisAfter) {
                  return (
                    <span key={page} aria-hidden className="px-2 text-muted-foreground">
                      …
                    </span>
                  );
                }

                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageClick(page)}
                    aria-current={currentPage === page ? 'page' : undefined}
                    className={cn(
                      'min-w-[2.5rem] tabular-nums',
                      currentPage !== page && 'hover:bg-tint'
                    )}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              {pt.betGenerator.summary.next}
            </Button>
          </div>

          <p className="text-center text-sm tabular-nums text-muted-foreground">
            {pt.betGenerator.summary.pageInfoPrefix} {startIndex + 1}{' '}
            {pt.betGenerator.summary.pageInfoMiddle} {Math.min(endIndex, result.bets.length)}{' '}
            {pt.betGenerator.summary.pageInfoSuffix} {result.bets.length}{' '}
            {pt.betGenerator.summary.betsLabel}
          </p>
        </nav>
      )}
    </div>
  );
}
