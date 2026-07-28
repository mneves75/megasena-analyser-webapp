'use client';

import { useRef, type ComponentType, type KeyboardEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BET_GENERATION_MODE, type BetGenerationMode } from '@/lib/constants';
import { type BetStrategy } from '@/lib/analytics/bet-generator.types';
import { cn } from '@/lib/utils';
import { pt } from '@/lib/i18n';
import {
  BarChart3,
  Check,
  Dices,
  FileText,
  Flame,
  Info,
  Ruler,
  Scale,
  Shuffle,
  Snowflake,
  Sparkles,
  Target,
  Play,
} from 'lucide-react';

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

type IconComponent = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

const STRATEGY_ICONS = {
  balanced: Scale,
  hot_numbers: Flame,
  cold_numbers: Snowflake,
  random: Dices,
  fibonacci: Ruler,
  custom: Sparkles,
} satisfies Record<BetStrategy, IconComponent>;

const MODE_ICONS = {
  [BET_GENERATION_MODE.OPTIMIZED]: Target,
  [BET_GENERATION_MODE.SIMPLE_ONLY]: FileText,
  [BET_GENERATION_MODE.MIXED]: Shuffle,
  [BET_GENERATION_MODE.MULTIPLE_ONLY]: BarChart3,
} satisfies Record<BetGenerationMode, IconComponent>;

/**
 * Roving-tabindex keyboard handler for an ARIA radiogroup: arrows move selection
 * and focus, Home/End jump to the ends. Only the checked radio is tabbable.
 */
function rovingKeyDown<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  values: readonly T[],
  refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
  onChange: (value: T) => void,
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

const SELECTED_TILE = 'border-primary bg-primary/10';
const IDLE_TILE = 'border-border bg-card hover:border-primary/60 hover:bg-accent/40';
const TILE_BASE =
  'relative rounded-lg border-2 transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

function SelectedCheck() {
  return (
    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check aria-hidden className="h-3 w-3" />
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
    <Card className={cn('transition-smooth hover:shadow-glow', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles aria-hidden className="h-5 w-5" />
          {pt.betGenerator.controls.title}
        </CardTitle>
        <CardDescription>{pt.betGenerator.controls.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Strategy Selection */}
        <div className="space-y-3">
          <Label className="text-base" id="strategy-label">
            {pt.betGenerator.controls.strategyLabel}
          </Label>
          <div
            className="grid grid-cols-2 gap-2 md:grid-cols-5"
            role="radiogroup"
            aria-labelledby="strategy-label"
          >
            {pt.betGenerator.strategies.map(({ value, label, description }, index) => {
              const typedValue = value as BetStrategy;
              const Icon = STRATEGY_ICONS[typedValue];
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
                  className={cn(
                    TILE_BASE,
                    'flex flex-col items-center justify-center p-4 text-center',
                    selected ? SELECTED_TILE : IDLE_TILE,
                  )}
                >
                  <Icon aria-hidden className="mb-1 h-6 w-6 text-foreground" />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className="mt-1 text-xs text-muted-foreground">{description}</span>
                  {selected && <SelectedCheck />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode Selection */}
        <div className="space-y-3">
          <Label className="text-base" id="mode-label">
            {pt.betGenerator.controls.modeLabel}
          </Label>
          <div
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            role="radiogroup"
            aria-labelledby="mode-label"
          >
            {pt.betGenerator.modes.map(({ value, label, description }, index) => {
              const typedValue = value as BetGenerationMode;
              const Icon = MODE_ICONS[typedValue];
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
                  className={cn(
                    TILE_BASE,
                    'flex items-start gap-3 p-4 text-left',
                    selected ? SELECTED_TILE : IDLE_TILE,
                  )}
                >
                  <Icon aria-hidden className="mt-0.5 h-6 w-6 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{description}</div>
                  </div>
                  {selected && <SelectedCheck />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info Box */}
        <div className="flex gap-3 rounded-lg border border-border/50 bg-muted/30 p-4">
          <Info aria-hidden className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">{pt.betGenerator.controls.infoTitle}:</strong>{' '}
              {pt.betGenerator.controls.infoOptimized}
            </p>
            <p>{pt.betGenerator.controls.infoBalanced}</p>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={onGenerate}
          disabled={disabled || isGenerating}
          aria-busy={isGenerating}
          size="lg"
          className="h-14 w-full text-lg font-semibold transition-smooth hover:shadow-glow"
        >
          {isGenerating ? (
            <>
              <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {pt.betGenerator.controls.generating}
            </>
          ) : (
            <>
              <Play aria-hidden className="mr-2 h-5 w-5" />
              {pt.betGenerator.controls.generate}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
