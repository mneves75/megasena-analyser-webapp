'use client';

import { useId, useState } from 'react';
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

function parseBudget(input: string): number {
  const value = input.trim().replace(/^R\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(value)) {
    return 0;
  }
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

export function BudgetSelector({
  value,
  onChange,
  min = BET_GENERATION_LIMITS.MIN_BUDGET,
  max = BET_GENERATION_LIMITS.MAX_BUDGET,
  isOptimizedMode = false,
  className,
}: BudgetSelectorProps) {
  const [inputValue, setInputValue] = useState(value.toString().replace('.', ','));
  const presetsLabelId = useId();
  const numericInputValue = parseBudget(inputValue);
  const isBelowMin = inputValue.length > 0 && numericInputValue < min;
  const isAboveMax = inputValue.length > 0 && numericInputValue > max;
  const hasBudgetError = isBelowMin || isAboveMax;
  const errorId = 'budget-input-error';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(parseBudget(val));
  };

  const handlePresetClick = (preset: number) => {
    setInputValue(preset.toString());
    onChange(preset);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <h3 className="text-lg font-semibold leading-tight">{pt.betGenerator.budget.title}</h3>
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
            inputMode="decimal"
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
        <p id={presetsLabelId} className="text-sm font-medium leading-none">
          {pt.betGenerator.budget.quickValues}
        </p>
        <div role="group" aria-labelledby={presetsLabelId} className="grid grid-cols-3 gap-2">
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
        <dl className="flex items-baseline justify-between border-y-2 border-y-primary py-3">
          <dt className="text-sm text-muted-foreground">{pt.betGenerator.budget.selectedBudget}</dt>
          <dd className="font-condensed text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(value)}
          </dd>
        </dl>
      )}
    </div>
  );
}
