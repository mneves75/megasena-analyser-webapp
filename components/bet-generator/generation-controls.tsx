'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { type BetGenerationMode } from '@/lib/constants';
import { type BetStrategy } from '@/lib/analytics/bet-generator.types';
import { cn } from '@/lib/utils';
import { pt } from '@/lib/i18n';

interface GenerationControlsProps {
  strategy: BetStrategy;
  mode: BetGenerationMode;
  onStrategyChange: (strategy: BetStrategy) => void;
  onModeChange: (mode: BetGenerationMode) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
  /**
   * Blocks generation only. The strategy and mode radiogroups stay interactive:
   * the budget ceiling depends on the selected mode, so disabling the mode
   * selector alongside the button would strand the user on an over-budget
   * message that tells them to pick a different mode.
   */
  disabled?: boolean;
  className?: string;
}

/**
 * Roving-tabindex keyboard handler for an ARIA radiogroup: arrows move selection
 * and focus, Home/End jump to the ends. Only the checked radio is tabbable.
 */
function rovingKeyDown<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  values: readonly T[],
  refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
  onChange: (value: T) => void
): void {
  let nextIndex: number | null = null;

  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      nextIndex = (index + 1) % values.length;
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      nextIndex = (index - 1 + values.length) % values.length;
      break;
    case 'Home':
      nextIndex = 0;
      break;
    case 'End':
      nextIndex = values.length - 1;
      break;
    default:
      return;
  }

  const nextValue = values[nextIndex];
  if (nextValue === undefined) return;

  event.preventDefault();
  onChange(nextValue);
  refs.current[nextIndex]?.focus();
}

const OPTION_ROW =
  'flex w-full items-start gap-3 border-b border-border py-3 text-left transition-colors hover:bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

/** The volante's mark: an empty ring, filled when chosen. */
function RadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary"
    >
      {selected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
    </span>
  );
}

function OptionText({ label, description }: { label: string; description: string }) {
  return (
    <span className="min-w-0">
      <span className="block font-medium text-foreground">{label}</span>
      <span className="block text-sm text-muted-foreground">{description}</span>
    </span>
  );
}

export function GenerationControls({
  strategy,
  mode,
  onStrategyChange,
  onModeChange,
  onGenerate,
  isGenerating = false,
  disabled = false,
  className,
}: GenerationControlsProps) {
  const strategyRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const modeRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const strategyValues = pt.betGenerator.strategies.map((s) => s.value as BetStrategy);
  const modeValues = pt.betGenerator.modes.map((m) => m.value as BetGenerationMode);

  return (
    <div className={cn('space-y-6', className)}>
      <h3 className="text-lg font-semibold leading-tight">{pt.betGenerator.controls.title}</h3>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground" id="strategy-label">
            {pt.betGenerator.controls.strategyLabel}
          </p>
          <div
            className="border-t-2 border-primary"
            role="radiogroup"
            aria-labelledby="strategy-label"
          >
            {pt.betGenerator.strategies.map(({ value, label, description }, index) => {
              const typedValue = value as BetStrategy;
              const selected = strategy === typedValue;
              return (
                <button
                  key={value}
                  ref={(el) => {
                    strategyRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => onStrategyChange(typedValue)}
                  onKeyDown={(e) =>
                    rovingKeyDown(e, index, strategyValues, strategyRefs, onStrategyChange)
                  }
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  className={OPTION_ROW}
                >
                  <RadioMark selected={selected} />
                  <OptionText label={label} description={description} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground" id="mode-label">
            {pt.betGenerator.controls.modeLabel}
          </p>
          <div className="border-t-2 border-primary" role="radiogroup" aria-labelledby="mode-label">
            {pt.betGenerator.modes.map(({ value, label, description }, index) => {
              const typedValue = value as BetGenerationMode;
              const selected = mode === typedValue;
              return (
                <button
                  key={value}
                  ref={(el) => {
                    modeRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => onModeChange(typedValue)}
                  onKeyDown={(e) => rovingKeyDown(e, index, modeValues, modeRefs, onModeChange)}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  className={OPTION_ROW}
                >
                  <RadioMark selected={selected} />
                  <OptionText label={label} description={description} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Button
        onClick={onGenerate}
        disabled={disabled || isGenerating}
        aria-busy={isGenerating}
        size="lg"
        className="h-12 w-full text-base sm:w-auto sm:min-w-64"
      >
        {isGenerating ? pt.betGenerator.controls.generating : pt.betGenerator.controls.generate}
      </Button>
    </div>
  );
}
