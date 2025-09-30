'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BetCard } from './bet-card';
import { type BetGenerationResult } from '@/lib/analytics/bet-generator';
import { cn } from '@/lib/utils';
import { TrendingUp, Target, PieChart, Wallet } from 'lucide-react';

interface BetListProps {
  result: BetGenerationResult;
  className?: string;
}

export function BetList({ result, className }: BetListProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  const formatPercentage = (val: number) => {
    return `${val.toFixed(1)}%`;
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Card */}
      <Card className="transition-smooth hover:shadow-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Resumo das Apostas
          </CardTitle>
          <CardDescription>
            {result.bets.length} {result.bets.length === 1 ? 'aposta gerada' : 'apostas geradas'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Cost */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="w-4 h-4" />
                <span className="text-sm">Custo Total</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                {formatCurrency(result.totalCost)}
              </span>
            </div>

            {/* Utilization */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Utilização</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {formatPercentage(result.budgetUtilization)}
                </span>
                {result.budgetUtilization >= 95 && (
                  <Badge variant="secondary" className="text-xs">
                    Ótimo
                  </Badge>
                )}
              </div>
            </div>

            {/* Numbers Covered */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="w-4 h-4" />
                <span className="text-sm">Números Únicos</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                {result.totalNumbers}
              </span>
            </div>

            {/* Remaining Budget */}
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Restante</span>
              <span className="text-2xl font-bold text-muted-foreground">
                {formatCurrency(result.remainingBudget)}
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-6 pt-6 border-t border-border/50 flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{result.summary.simpleBets}</strong>{' '}
              {result.summary.simpleBets === 1 ? 'simples' : 'simples'}
            </span>
            <span className="text-border">•</span>
            <span>
              <strong className="text-foreground">{result.summary.multipleBets}</strong>{' '}
              {result.summary.multipleBets === 1 ? 'múltipla' : 'múltiplas'}
            </span>
            <span className="text-border">•</span>
            <span>
              Média: <strong className="text-foreground">{formatCurrency(result.summary.averageCost)}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {result.bets.map((bet, index) => (
          <BetCard key={bet.id} bet={bet} index={index} />
        ))}
      </div>

      {/* Info Message */}
      {result.remainingBudget >= 6 && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-sm text-muted-foreground">
          <strong className="text-foreground">Dica:</strong> Você ainda tem{' '}
          {formatCurrency(result.remainingBudget)} disponível. Considere aumentar o orçamento
          para maximizar a utilização.
        </div>
      )}
    </div>
  );
}
