'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DezenaChips } from '@/app/_components/archive-ui';
import { type Bet } from '@/lib/analytics/bet-generator.types';
import { formatCurrency } from '@/lib/utils';
import { formatBetTypeLabel, formatStrategyLabel, pt } from '@/lib/i18n';

interface BetRowProps {
  bet: Bet;
  index: number;
}

/** One generated bet as a ruled row: position, numbers, type, cost and strategy. */
export function BetRow({ bet, index }: BetRowProps) {
  const [copied, setCopied] = useState(false);

  const copyNumbers = async () => {
    try {
      await navigator.clipboard.writeText(bet.numbers.join(' - '));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available or permission denied: leave the button as is.
      setCopied(false);
    }
  };

  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 py-3">
      <span className="pt-0.5 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
      <div className="min-w-0 space-y-1">
        <DezenaChips numbers={bet.numbers} />
        <p className="text-xs text-muted-foreground">
          {formatBetTypeLabel(bet.type, bet.numberCount)} ·{' '}
          <span className="tabular-nums text-foreground">{formatCurrency(bet.cost)}</span> ·{' '}
          {pt.betGenerator.betCard.strategyLabel}: {formatStrategyLabel(bet.strategy)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={copyNumbers}
        aria-label={`${copied ? pt.betGenerator.betCard.copied : pt.betGenerator.betCard.copy} ${pt.betGenerator.betCard.betLabel.toLowerCase()} ${index + 1}`}
      >
        {copied ? pt.betGenerator.betCard.copied : pt.betGenerator.betCard.copy}
      </Button>
    </li>
  );
}
