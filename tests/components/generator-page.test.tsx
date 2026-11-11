import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GeneratorPage from '@/app/dashboard/generator/page';
import { pt } from '@/lib/i18n';

vi.mock('@/components/seo/page-json-ld', () => ({ PageJsonLd: () => null }));
vi.mock('@/app/dashboard/generator/actions', () => ({ generateBets: vi.fn() }));

describe('GeneratorPage', () => {
  it('drops the "Como funciona" paragraph: the about page explains the optimizer', () => {
    render(<GeneratorPage />);
    expect(screen.queryByRole('heading', { name: 'Como funciona o gerador' })).toBeNull();
  });

  it('keeps the randomness note and every strategy and mode', () => {
    render(<GeneratorPage />);
    expect(screen.getByText('Nota.')).toBeInTheDocument();
    expect(screen.getByText(pt.generatorPage.disclaimer.text)).toBeInTheDocument();
    for (const option of [...pt.betGenerator.strategies, ...pt.betGenerator.modes]) {
      expect(screen.getByRole('radio', { name: new RegExp(option.label) })).toBeInTheDocument();
    }
  });
});
