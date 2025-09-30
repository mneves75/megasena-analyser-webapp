import { NextRequest, NextResponse } from 'next/server';
import { BetGenerator, BetStrategy } from '@/lib/analytics/bet-generator';
import { BET_GENERATION_MODE, type BetGenerationMode } from '@/lib/constants';

export interface GenerateBetsRequest {
  budget: number;
  strategy?: BetStrategy;
  mode?: BetGenerationMode;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateBetsRequest = await request.json();
    const {
      budget,
      strategy = 'balanced',
      mode = BET_GENERATION_MODE.OPTIMIZED
    } = body;

    // Validate budget
    if (!budget || typeof budget !== 'number' || budget < 6) {
      return NextResponse.json(
        {
          error: 'Orçamento inválido. Mínimo: R$ 6,00',
          details: 'O valor mínimo para apostar na Mega-Sena é R$ 6,00 (aposta simples de 6 números).'
        },
        { status: 400 }
      );
    }

    if (budget > 1000000) {
      return NextResponse.json(
        {
          error: 'Orçamento excede o limite máximo',
          details: 'O valor máximo permitido é R$ 1.000.000,00.'
        },
        { status: 400 }
      );
    }

    // Validate strategy
    const validStrategies: BetStrategy[] = ['random', 'hot_numbers', 'cold_numbers', 'balanced', 'fibonacci', 'custom'];
    if (!validStrategies.includes(strategy)) {
      return NextResponse.json(
        {
          error: 'Estratégia inválida',
          details: `Estratégias válidas: ${validStrategies.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate mode
    const validModes = Object.values(BET_GENERATION_MODE);
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        {
          error: 'Modo de geração inválido',
          details: `Modos válidos: ${validModes.join(', ')}`
        },
        { status: 400 }
      );
    }

    const generator = new BetGenerator();
    const result = generator.generateOptimizedBets(budget, mode, strategy);

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        budget: budget,
        strategy: strategy,
        mode: mode,
      }
    });

  } catch (error) {
    console.error('Error generating bets:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar apostas';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET endpoint to return available options
export async function GET() {
  return NextResponse.json({
    strategies: [
      { value: 'random', label: 'Aleatória', description: 'Números completamente aleatórios' },
      { value: 'hot_numbers', label: 'Números Quentes', description: 'Números mais sorteados historicamente' },
      { value: 'cold_numbers', label: 'Números Frios', description: 'Números menos sorteados historicamente' },
      { value: 'balanced', label: 'Balanceada', description: 'Mix de números quentes e frios' },
      { value: 'fibonacci', label: 'Fibonacci', description: 'Baseada na sequência de Fibonacci' },
    ],
    modes: [
      { value: BET_GENERATION_MODE.SIMPLE_ONLY, label: 'Apenas Simples', description: 'Somente apostas de 6 números' },
      { value: BET_GENERATION_MODE.MULTIPLE_ONLY, label: 'Apenas Múltipla', description: 'Uma única aposta múltipla (7-15 números)' },
      { value: BET_GENERATION_MODE.MIXED, label: 'Mista', description: '60% múltiplas, 40% simples' },
      { value: BET_GENERATION_MODE.OPTIMIZED, label: 'Otimizada', description: 'Minimiza desperdício de orçamento' },
    ],
    limits: {
      minBudget: 6,
      maxBudget: 1000000,
      minNumbers: 6,
      maxNumbers: 15,
    }
  });
}
