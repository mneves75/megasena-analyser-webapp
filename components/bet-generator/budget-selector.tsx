'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BUDGET_PRESETS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface BudgetSelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function BudgetSelector({
  value,
  onChange,
  min = 6,
  max = 100000,
  className
}: BudgetSelectorProps) {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\d]/g, '');
    setInputValue(val);

    const numValue = parseInt(val) || 0;
    if (numValue >= min && numValue <= max) {
      onChange(numValue);
    }
  };

  const handlePresetClick = (preset: number) => {
    setInputValue(preset.toString());
    onChange(preset);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  return (
    <Card className={cn('transition-smooth hover:shadow-glow', className)}>
      <CardHeader>
        <CardTitle>Orçamento</CardTitle>
        <CardDescription>
          Defina o valor disponível para suas apostas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Custom Input */}
        <div className="space-y-2">
          <Label htmlFor="budget-input">Valor Personalizado</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              R$
            </span>
            <Input
              id="budget-input"
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              className="pl-10 text-lg font-semibold"
              placeholder="0,00"
            />
          </div>
          {value < min && (
            <p className="text-sm text-destructive">
              Valor mínimo: {formatCurrency(min)}
            </p>
          )}
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <Label>Valores Rápidos</Label>
          <div className="grid grid-cols-3 gap-2">
            {BUDGET_PRESETS.slice(0, 9).map((preset) => (
              <Button
                key={preset}
                variant={value === preset ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetClick(preset)}
                className="transition-smooth"
              >
                {formatCurrency(preset)}
              </Button>
            ))}
          </div>
        </div>

        {/* Display Selected */}
        {value >= min && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Orçamento selecionado:
              </span>
              <span className="text-xl font-bold text-foreground">
                {formatCurrency(value)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
