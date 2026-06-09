import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BetList } from '@/components/bet-generator/bet-list';
import { type BetGenerationResult } from '@/lib/analytics/bet-generator.types';

function createMockResult(betCount: number, totalCost: number): BetGenerationResult {
  const bets = Array.from({ length: betCount }, (_, i) => ({
    id: `bet-${i}`,
    numbers: [1, 2, 3, 4, 5, 6].map((n) => n + i),
    cost: 6,
    type: 'simple' as const,
    numberCount: 6,
    strategy: 'random',
  }));

  return {
    bets,
    totalCost,
    remainingBudget: 100 - totalCost,
    budgetUtilization: (totalCost / 100) * 100,
    totalNumbers: betCount * 6,
    strategy: 'random',
    mode: 'optimized',
    summary: {
      simpleBets: betCount,
      multipleBets: 0,
      averageCost: totalCost / betCount,
    },
  };
}

function getResultKey(result: BetGenerationResult): string {
  return result.bets.map((bet) => bet.id).join('|');
}

describe('BetList', () => {
  it('renderiza a primeira página com o resumo inicial', () => {
    const result = createMockResult(21, 126);

    render(<BetList result={result} />);

    expect(screen.getByText(/Exibindo 1 a 20 de 21 apostas/i)).toBeInTheDocument();
    expect(screen.getByText(/Resumo das Apostas/i)).toBeInTheDocument();
  });

  it('permite navegar para a página seguinte', () => {
    const result = createMockResult(21, 126);

    render(<BetList result={result} />);
    fireEvent.click(screen.getByRole('button', { name: /próxima/i }));

    expect(screen.getByText(/Exibindo 21 a 21 de 21 apostas/i)).toBeInTheDocument();
  });

  it('reinicia a paginação quando recebe uma nova chave', () => {
    const result1 = createMockResult(21, 126);
    const result2 = createMockResult(22, 132);
    const key1 = getResultKey(result1);
    const key2 = getResultKey(result2);

    const { unmount } = render(<BetList key={key1} result={result1} />);
    fireEvent.click(screen.getByRole('button', { name: /próxima/i }));
    expect(screen.getByText(/Exibindo 21 a 21 de 21 apostas/i)).toBeInTheDocument();

    unmount();
    render(<BetList key={key2} result={result2} />);

    expect(screen.getByText(/Exibindo 1 a 20 de 22 apostas/i)).toBeInTheDocument();
  });

  it('gera chaves distintas para resultados diferentes', () => {
    const result1 = createMockResult(10, 60);
    const result2 = createMockResult(15, 90);
    const result3 = {
      ...createMockResult(10, 60),
      bets: createMockResult(10, 60).bets.map((bet) => ({ ...bet })),
    };

    const key1 = getResultKey(result1);
    const key2 = getResultKey(result2);
    const key3 = getResultKey(result3);

    expect(key1).not.toBe(key2);
    expect(key1).toBe(key3);
  });

  it('mostra as métricas de resumo e a utilização do orçamento', () => {
    const result = createMockResult(10, 60);

    render(<BetList result={result} />);

    expect(screen.getByText(/R\$ 60,00/i)).toBeInTheDocument();
    expect(screen.getByText(/Números Únicos/i)).toBeInTheDocument();
    expect(screen.getByText(/60\.0%/i)).toBeInTheDocument();
  });

  it('omite a paginação quando todas as apostas cabem em uma página', () => {
    const result = createMockResult(10, 60);

    render(<BetList result={result} />);

    expect(screen.queryByRole('button', { name: /próxima/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anterior/i })).not.toBeInTheDocument();
  });

  it('desabilita o botão anterior na primeira página', () => {
    const result = createMockResult(21, 126);

    render(<BetList result={result} />);

    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
  });

  it('desabilita o botão seguinte na última página', () => {
    const result = createMockResult(21, 126);

    render(<BetList result={result} />);
    const nextButton = screen.getByRole('button', { name: /próxima/i });
    fireEvent.click(nextButton);

    expect(nextButton).toBeDisabled();
  });

  it('mostra dica quando ainda há orçamento suficiente para outra aposta', () => {
    const result = createMockResult(10, 60);
    result.remainingBudget = 40;

    render(<BetList result={result} />);

    expect(screen.getByText(/Você ainda tem/i)).toBeInTheDocument();
    expect(screen.getByText(/Considere aumentar o orçamento/i)).toBeInTheDocument();
  });

  it('omite a dica quando o orçamento restante é insuficiente', () => {
    const result = createMockResult(16, 96);
    result.remainingBudget = 4;

    render(<BetList result={result} />);

    expect(screen.queryByText(/Você ainda tem/i)).not.toBeInTheDocument();
  });
});
