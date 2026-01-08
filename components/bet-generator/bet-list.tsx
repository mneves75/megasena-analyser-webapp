'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BetCard } from './bet-card';
import { type BetGenerationResult } from '@/lib/analytics/bet-generator';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import { TrendingUp, Target, PieChart, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
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
    if (val === null) return '0.0%';
    return formatPercentage(val, 1);
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

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Card */}
      <Card className="transition-smooth hover:shadow-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            {pt.betGenerator.summary.title}
          </CardTitle>
          <CardDescription>
            {result.bets.length}{' '}
            {result.bets.length === 1
              ? pt.betGenerator.summary.generatedSingle
              : pt.betGenerator.summary.generatedPlural}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Cost */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="w-4 h-4" />
                <span className="text-sm">{pt.betGenerator.summary.totalCost}</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                {formatCurrencyValue(result.totalCost)}
              </span>
            </div>

            {/* Utilization */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">{pt.betGenerator.summary.utilization}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {formatPercentageValue(result.budgetUtilization)}
                </span>
                {result.budgetUtilization !== null && result.budgetUtilization >= 95 && (
                  <Badge variant="secondary" className="text-xs">
                    {pt.betGenerator.summary.utilizationGreat}
                  </Badge>
                )}
              </div>
            </div>

            {/* Numbers Covered */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="w-4 h-4" />
                <span className="text-sm">{pt.betGenerator.summary.uniqueNumbers}</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                {result.totalNumbers}
              </span>
            </div>

            {/* Remaining Budget */}
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{pt.betGenerator.summary.remaining}</span>
              <span className="text-2xl font-bold text-muted-foreground">
                {formatCurrencyValue(result.remainingBudget)}
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-6 pt-6 border-t border-border/50 flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{result.summary.simpleBets}</strong>{' '}
              {pt.betGenerator.summary.simpleLabel}
            </span>
            <span className="text-border">•</span>
            <span>
              <strong className="text-foreground">{result.summary.multipleBets}</strong>{' '}
              {result.summary.multipleBets === 1
                ? pt.betGenerator.summary.multipleSingle
                : pt.betGenerator.summary.multiplePlural}
            </span>
            <span className="text-border">•</span>
            <span>
              {pt.betGenerator.summary.average}:{' '}
              <strong className="text-foreground">
                {formatCurrencyValue(result.summary.averageCost)}
              </strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentBets.map((bet, index) => (
          <BetCard key={bet.id} bet={bet} index={startIndex + index} />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="transition-smooth hover:scale-105"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {pt.betGenerator.summary.previous}
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first, last, current, and pages around current
              const showPage =
                page === 1 ||
                page === totalPages ||
                Math.abs(page - currentPage) <= 1;

              // Show ellipsis
              const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
              const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

              if (!showPage && !showEllipsisBefore && !showEllipsisAfter) {
                return null;
              }

              if (showEllipsisBefore || showEllipsisAfter) {
                return (
                  <span key={page} className="px-2 text-muted-foreground">
                    ...
                  </span>
                );
              }

              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageClick(page)}
                  className={cn(
                    'min-w-[2.5rem] transition-smooth',
                    currentPage === page
                      ? 'shadow-glow'
                      : 'hover:scale-105'
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
            className="transition-smooth hover:scale-105"
          >
            {pt.betGenerator.summary.next}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Page Info */}
      {totalPages > 1 && (
        <div className="text-center text-sm text-muted-foreground">
          {pt.betGenerator.summary.pageInfoPrefix} {startIndex + 1}{' '}
          {pt.betGenerator.summary.pageInfoMiddle}{' '}
          {Math.min(endIndex, result.bets.length)} {pt.betGenerator.summary.pageInfoSuffix}{' '}
          {result.bets.length} {pt.betGenerator.summary.betsLabel}
        </div>
      )}

      {/* Info Message */}
      {result.remainingBudget !== null && result.remainingBudget >= 6 && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-sm text-muted-foreground">
          <strong className="text-foreground">{pt.common.tipLabel}:</strong>{' '}
          {pt.betGenerator.summary.remainingTipPrefix}{' '}
          {formatCurrencyValue(result.remainingBudget)}{' '}
          {pt.betGenerator.summary.remainingTipSuffix}
        </div>
      )}
    </div>
  );
}
