'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LotteryBall } from '@/components/lottery-ball';
import { type Bet } from '@/lib/analytics/bet-generator';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';

interface BetCardProps {
  bet: Bet;
  index: number;
  className?: string;
}

export function BetCard({ bet, index, className }: BetCardProps) {
  const [copied, setCopied] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  const copyNumbers = async () => {
    const numbersText = bet.numbers.join(' - ');
    try {
      await navigator.clipboard.writeText(numbersText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available or user denied permission - fail silently
      setCopied(false);
    }
  };

  const getBetTypeLabel = () => {
    if (bet.type === 'simple') return 'Simples';
    return `Múltipla (${bet.numberCount} números)`;
  };

  const getBetTypeColor = () => {
    if (bet.type === 'simple') return 'default';
    return 'secondary';
  };

  return (
    <Card className={cn('group transition-smooth hover:shadow-glow hover:border-primary/50', className)}>
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">
                Aposta #{index + 1}
              </h3>
              <Badge variant={getBetTypeColor() as 'default' | 'secondary' | 'destructive' | 'outline'}>
                {getBetTypeLabel()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Custo: <span className="font-medium text-foreground">{formatCurrency(bet.cost)}</span>
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={copyNumbers}
            className="transition-smooth hover:bg-primary hover:text-primary-foreground"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copiar
              </>
            )}
          </Button>
        </div>

        {/* Numbers */}
        <div className="flex flex-wrap gap-2 items-center justify-center py-4">
          {bet.numbers.map((number) => (
            <LotteryBall
              key={number}
              number={number}
              size="md"
              className="transition-smooth group-hover:scale-110"
            />
          ))}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground capitalize">
            Estratégia: {bet.strategy.replace('_', ' ')}
          </span>
          <span className="text-xs text-muted-foreground">
            {bet.numbers.length} números
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
