import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardError from '@/app/dashboard/error';

describe('DashboardError', () => {
  it('renders the fallback UI and allows retrying', () => {
    const reset = vi.fn();

    render(
      <DashboardError
        error={Object.assign(new Error('Falha simulada'), { digest: 'digest-1' })}
        reset={reset}
      />
    );

    expect(screen.getByRole('heading', { name: 'Algo deu errado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
