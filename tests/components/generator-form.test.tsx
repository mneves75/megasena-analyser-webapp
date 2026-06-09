import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeneratorForm } from '@/app/dashboard/generator/generator-form';

vi.mock('@/app/dashboard/generator/actions', () => ({
  generateBets: vi.fn(),
}));

import { generateBets } from '@/app/dashboard/generator/actions';

type DeferredResult = {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred(): DeferredResult {
  let resolve!: (value: unknown) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<unknown>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

function createResult() {
  return {
    bets: [
      {
        id: 'bet-1',
        numbers: [1, 2, 3, 4, 5, 6],
        cost: 6,
        type: 'simple' as const,
        numberCount: 6,
        strategy: 'balanced',
      },
    ],
    totalCost: 6,
    remainingBudget: 44,
    budgetUtilization: 12,
    totalNumbers: 6,
    strategy: 'balanced',
    mode: 'optimized',
    summary: {
      simpleBets: 1,
      multipleBets: 0,
      averageCost: 6,
    },
  };
}

function createResultWithId(id: string, numbers: number[]) {
  return {
    bets: [
      {
        id,
        numbers,
        cost: 6,
        type: 'simple' as const,
        numberCount: 6,
        strategy: 'balanced',
      },
    ],
    totalCost: 6,
    remainingBudget: 44,
    budgetUtilization: 12,
    totalNumbers: 6,
    strategy: 'balanced',
    mode: 'optimized',
    summary: {
      simpleBets: 1,
      multipleBets: 0,
      averageCost: 6,
    },
  };
}

describe('GeneratorForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza o estado inicial com os controles principais', () => {
    render(<GeneratorForm />);

    expect(screen.getByText(/Pronto para gerar apostas\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar Apostas/i })).toBeInTheDocument();
    expect(screen.getByText(/Configurações de Geração/i)).toBeInTheDocument();
  });

  it('envia a geração usando os valores padrão ao clicar no botão', async () => {
    vi.mocked(generateBets).mockResolvedValue(createResult());

    render(<GeneratorForm />);
    fireEvent.click(screen.getByRole('button', { name: /Gerar Apostas/i }));

    await waitFor(() => {
      expect(generateBets).toHaveBeenCalledWith(50, 'balanced', 'optimized');
    });
  });

  it('mostra estado de carregamento e renderiza o resultado quando a ação resolve', async () => {
    const deferred = createDeferred();
    vi.mocked(generateBets).mockReturnValue(deferred.promise as ReturnType<typeof generateBets>);

    render(<GeneratorForm />);
    fireEvent.click(screen.getByRole('button', { name: /Gerar Apostas/i }));

    expect(screen.getByRole('button', { name: /Gerando apostas/i })).toBeDisabled();

    deferred.resolve(createResult());

    await waitFor(() => {
      expect(screen.getByText(/Resumo das Apostas/i)).toBeInTheDocument();
    });
  });

  it('exibe a mensagem de erro quando a geração falha', async () => {
    vi.mocked(generateBets).mockRejectedValue(new Error('Falha controlada'));

    render(<GeneratorForm />);
    fireEvent.click(screen.getByRole('button', { name: /Gerar Apostas/i }));

    await waitFor(() => {
      expect(screen.getByText(/Erro:/i)).toBeInTheDocument();
      expect(screen.getByText(/Falha controlada/i)).toBeInTheDocument();
    });
  });

  it('não tenta atualizar a interface depois do unmount com requisição pendente', async () => {
    const deferred = createDeferred();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(generateBets).mockReturnValue(deferred.promise as ReturnType<typeof generateBets>);

    const { unmount } = render(<GeneratorForm />);
    fireEvent.click(screen.getByRole('button', { name: /Gerar Apostas/i }));
    unmount();

    deferred.resolve(createResult());
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('ignora a resposta antiga quando duas gerações são disparadas em sequência', async () => {
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    vi.mocked(generateBets)
      .mockReturnValueOnce(firstRequest.promise as ReturnType<typeof generateBets>)
      .mockReturnValueOnce(secondRequest.promise as ReturnType<typeof generateBets>);

    render(<GeneratorForm />);

    const generateButton = screen.getByRole('button', { name: /Gerar Apostas/i });
    fireEvent.click(generateButton);
    fireEvent.click(generateButton);

    firstRequest.resolve(createResultWithId('bet-old', [1, 2, 3, 4, 5, 6]));
    secondRequest.resolve(createResultWithId('bet-new', [7, 8, 9, 10, 11, 12]));

    await waitFor(() => {
      expect(screen.getByText(/Aposta #1/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/7/)).toBeInTheDocument();
    expect(screen.queryByText(/bet-old/i)).not.toBeInTheDocument();
  });
});
