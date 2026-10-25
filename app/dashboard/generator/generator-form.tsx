'use client';

import { useState, useEffect, useRef } from 'react';
import { BudgetSelector, GenerationControls, BetList } from '@/components/bet-generator';
import { type BetGenerationResult, type BetStrategy } from '@/lib/analytics/bet-generator.types';
import {
  BET_GENERATION_LIMITS,
  BET_GENERATION_MODE,
  type BetGenerationMode,
} from '@/lib/constants';
import { generateBets } from './actions';
import { pt } from '@/lib/i18n';
import { NumberField } from '@/components/number-field';

export function GeneratorForm() {
  const [budget, setBudget] = useState<number>(50);
  const [strategy, setStrategy] = useState<BetStrategy>('balanced');
  const [mode, setMode] = useState<BetGenerationMode>(BET_GENERATION_MODE.OPTIMIZED);
  const [result, setResult] = useState<BetGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard async state updates after unmount.
  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      activeRequestIdRef.current += 1;
    };
  }, []);

  // The optimizer's dynamic program is bounded by a lower budget than the other
  // modes, and the API rejects anything above it. Mirror that ceiling in the
  // form so the limit is visible before submitting rather than as a 400.
  const maxBudget =
    mode === BET_GENERATION_MODE.OPTIMIZED
      ? BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET
      : BET_GENERATION_LIMITS.MAX_BUDGET;
  const isBudgetValid = budget >= BET_GENERATION_LIMITS.MIN_BUDGET && budget <= maxBudget;

  async function handleGenerate(): Promise<void> {
    activeRequestIdRef.current += 1;
    const requestId = activeRequestIdRef.current;

    setIsGenerating(true);
    setError(null);

    try {
      const data = await generateBets(budget, strategy, mode);

      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        if ('error' in data) {
          setError(data.error);
          requestAnimationFrame(() => errorRef.current?.focus());
          return;
        }
        setResult(data);
        requestAnimationFrame(() => resultsRef.current?.focus());
      }
    } catch {
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        setError(pt.generatorForm.errorFallback);
        requestAnimationFrame(() => errorRef.current?.focus());
        // Error already logged by server, no need to log again on client
      }
    } finally {
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        setIsGenerating(false);
      }
    }
  }

  return (
    <section aria-labelledby="generator-form-title">
      <h2 id="generator-form-title" className="sr-only">
        Configurar e gerar apostas
      </h2>
      {/* Error Display */}
      {error && (
        <div
          ref={errorRef}
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          className="mb-6 border-t-2 border-destructive pt-3 text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <strong className="font-semibold">{pt.generatorForm.errorPrefix}:</strong> {error}
        </div>
      )}

      {/* Configuration Section */}
      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        {/* Budget Selector - 1 column */}
        <div className="lg:col-span-1">
          <BudgetSelector
            value={budget}
            onChange={setBudget}
            min={BET_GENERATION_LIMITS.MIN_BUDGET}
            max={maxBudget}
            isOptimizedMode={mode === BET_GENERATION_MODE.OPTIMIZED}
            className="h-full"
          />
        </div>

        {/* Generation Controls - 2 columns */}
        <div className="lg:col-span-2">
          <GenerationControls
            strategy={strategy}
            mode={mode}
            onStrategyChange={setStrategy}
            onModeChange={setMode}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            disabled={!isBudgetValid}
          />
        </div>
      </div>

      {/* Results Section */}
      <div
        ref={resultsRef}
        tabIndex={-1}
        aria-live="polite"
        className="mt-8 focus-visible:outline-none"
      >
        {result ? (
          <div>
            <BetList key={result.bets.map((bet) => bet.id).join('|')} result={result} />
          </div>
        ) : (
          <div className="border-t-2 border-primary pt-5">
            <NumberField struck={[]} label="Volante vazio, de 01 a 60" />
          </div>
        )}
      </div>
    </section>
  );
}
