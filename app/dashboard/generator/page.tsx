'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BudgetSelector, GenerationControls, BetList } from '@/components/bet-generator';
import { type BetGenerationResult, type BetStrategy } from '@/lib/analytics/bet-generator';
import { BET_GENERATION_MODE, type BetGenerationMode } from '@/lib/constants';

export default function GeneratorPage() {
  const [budget, setBudget] = useState<number>(50);
  const [strategy, setStrategy] = useState<BetStrategy>('balanced');
  const [mode, setMode] = useState<BetGenerationMode>(BET_GENERATION_MODE.OPTIMIZED);
  const [result, setResult] = useState<BetGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateBets() {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget,
          strategy,
          mode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar apostas');
      }

      if (data.success && data.data) {
        setResult(data.data);
      } else {
        throw new Error(data.error || 'Erro ao processar apostas');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar apostas. Tente novamente.';
      setError(errorMessage);
      console.error('Error generating bets:', err);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-2xl font-bold hover:text-primary transition-smooth">
              Mega-Sena Analyser
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" className="transition-smooth hover:scale-105">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Gerador de Apostas Otimizado
          </h1>
          <p className="text-muted-foreground text-lg">
            Sistema inteligente de geração de apostas que minimiza desperdício de orçamento
          </p>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/50 text-destructive">
            <strong className="font-semibold">Erro:</strong> {error}
          </div>
        )}

        {/* Configuration Section */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          {/* Budget Selector - 1 column */}
          <div className="lg:col-span-1">
            <BudgetSelector
              value={budget}
              onChange={setBudget}
              min={6}
              max={100000}
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
              onGenerate={generateBets}
              isGenerating={isGenerating}
              disabled={budget < 6}
            />
          </div>
        </div>

        {/* Results Section */}
        <div className="mt-8">
          {result ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <BetList result={result} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-8 rounded-2xl border-2 border-dashed border-border/50 bg-card/30">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-foreground">
                    Pronto para gerar apostas?
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Configure seu orçamento, escolha uma estratégia e um modo de geração,
                    depois clique em <strong className="text-foreground">&quot;Gerar Apostas&quot;</strong> para começar.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Sistema otimizado minimiza desperdício do seu orçamento</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-12 p-6 rounded-lg bg-muted/30 border border-border/50">
          <h3 className="font-semibold text-foreground mb-3">Como funciona?</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="space-y-1">
              <div className="font-medium text-foreground">1. Defina o Orçamento</div>
              <p>Escolha quanto deseja investir nas apostas. Mínimo de R$ 6,00.</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-foreground">2. Configure a Estratégia</div>
              <p>Escolha como os números serão selecionados: aleatório, quentes, frios, etc.</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-foreground">3. Selecione o Modo</div>
              <p>Otimizado minimiza desperdício. Simples, Mista ou Múltipla para preferências específicas.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
