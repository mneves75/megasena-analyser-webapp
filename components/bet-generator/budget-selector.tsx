'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BET_GENERATION_LIMITS, BUDGET_PRESETS } from '@/lib/constants';
import { cn, formatCurrency } from '@/lib/utils';
import { pt } from '@/lib/i18n';

interface BudgetSelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Adds the optimizer-specific hint when the value exceeds that mode's cap. */
  isOptimizedMode?: boolean;
  className?: string;
}

export function BudgetSelector({
  value,
  onChange,
  min = BET_GENERATION_LIMITS.MIN_BUDGET,
  max = BET_GENERATION_LIMITS.MAX_BUDGET,
  isOptimizedMode = false,
  className
}: BudgetSelectorProps) {
  const [inputValue, setInputValue] = useState(value.toString());
  const numericInputValue = inputValue.length > 0 ? Number.parseInt(inputValue, 10) : 0;
  const isBelowMin = inputValue.length > 0 && numericInputValue < min;
  const isAboveMax = inputValue.length > 0 && numericInputValue > max;
  const hasBudgetError = isBelowMin || isAboveMax;
  const errorId = 'budget-input-error';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\d]/g, '');
    setInputValue(val);
    onChange(Number.parseInt(val, 10) || 0);
  };

  const handlePresetClick = (preset: number) => {
    setInputValue(preset.toString());
    onChange(preset);
  };

  return (
    <Card className={cn('transition-smooth hover:shadow-glow', className)}>
      <CardHeader>
        <CardTitle>{pt.betGenerator.budget.title}</CardTitle>
        <CardDescription>{pt.betGenerator.budget.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Custom Input */}
        <div className="space-y-2">
          <Label htmlFor="budget-input">{pt.betGenerator.budget.customValue}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {pt.betGenerator.budget.currencyPrefix}
            </span>
            <Input
              id="budget-input"
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              inputMode="numeric"
              pattern="[0-9]*"
              aria-invalid={hasBudgetError ? 'true' : undefined}
              aria-errormessage={hasBudgetError ? errorId : undefined}
              className="pl-10 text-lg font-semibold tabular-nums"
              placeholder={pt.betGenerator.budget.placeholder}
            />
          </div>
          {hasBudgetError && (
            <p id={errorId} className="text-sm text-destructive">
              {isAboveMax ? (
                <>
                  {pt.betGenerator.budget.maxValueLabel} {formatCurrency(max)}
                  {isOptimizedMode ? ` — ${pt.betGenerator.budget.optimizedLimitHint}` : ''}
                </>
              ) : (
                <>
                  {pt.betGenerator.budget.minValueLabel} {formatCurrency(min)}
                </>
              )}
            </p>
          )}
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <Label>{pt.betGenerator.budget.quickValues}</Label>
          <div className="grid grid-cols-3 gap-2">
            {BUDGET_PRESETS.slice(0, 9).map((preset) => (
              <Button
                key={preset}
                variant={value === preset ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetClick(preset)}
                aria-pressed={value === preset}
                className="tabular-nums transition-smooth"
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
                {pt.betGenerator.budget.selectedBudget}
              </span>
              <span className="text-xl font-bold tabular-nums text-foreground">
                {formatCurrency(value)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
