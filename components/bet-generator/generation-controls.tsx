'use client';

import type { ComponentType } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BET_GENERATION_MODE, type BetGenerationMode } from '@/lib/constants';
import { type BetStrategy } from '@/lib/analytics/bet-generator';
import { cn } from '@/lib/utils';
import { pt } from '@/lib/i18n';
import {
  BarChart3,
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

export function GenerationControls({
  strategy,
  mode,
  onStrategyChange,
  onModeChange,
  onGenerate,
  isGenerating = false,
  disabled = false,
  className
}: GenerationControlsProps) {
  return (
    <Card className={cn('transition-smooth hover:shadow-glow', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          {pt.betGenerator.controls.title}
        </CardTitle>
        <CardDescription>{pt.betGenerator.controls.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Strategy Selection */}
        <div className="space-y-3">
          <Label className="text-base">{pt.betGenerator.controls.strategyLabel}</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {pt.betGenerator.strategies.map(({ value, label, description }) => {
              const Icon = STRATEGY_ICONS[value as BetStrategy];
              return (
              <button
                key={value}
                onClick={() => onStrategyChange(value)}
                disabled={disabled}
                className={cn(
                  'relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-smooth hover:scale-105',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  strategy === value
                    ? 'border-primary bg-primary/10 shadow-glow'
                    : 'border-border bg-card hover:border-primary/50'
                )}
              >
                <Icon aria-hidden className="h-6 w-6 mb-1 text-foreground" />
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  {description}
                </span>
                {strategy === value && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            );
            })}
          </div>
        </div>

        {/* Mode Selection */}
        <div className="space-y-3">
          <Label className="text-base">{pt.betGenerator.controls.modeLabel}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pt.betGenerator.modes.map(({ value, label, description }) => {
              const Icon = MODE_ICONS[value as BetGenerationMode];
              return (
              <button
                key={value}
                onClick={() => onModeChange(value)}
                disabled={disabled}
                className={cn(
                  'relative flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-smooth hover:scale-105',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  mode === value
                    ? 'border-primary bg-primary/10 shadow-glow'
                    : 'border-border bg-card hover:border-primary/50'
                )}
              >
                <Icon aria-hidden className="h-6 w-6 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{description}</div>
                </div>
                {mode === value && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            );
            })}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50 flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">{pt.betGenerator.controls.infoTitle}:</strong>{' '}
              {pt.betGenerator.controls.infoOptimized}
            </p>
            <p>
              {pt.betGenerator.controls.infoBalanced}
            </p>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={onGenerate}
          disabled={disabled || isGenerating}
          size="lg"
          className="w-full h-14 text-lg font-semibold transition-smooth hover:scale-105 hover:shadow-glow"
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              {pt.betGenerator.controls.generating}
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              {pt.betGenerator.controls.generate}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
