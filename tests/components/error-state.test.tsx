import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppError from '@/app/error';
import DashboardError from '@/app/dashboard/error';
import GeneratorError from '@/app/dashboard/generator/error';
import NotFound from '@/app/not-found';
import { LoadingState } from '@/components/loading-state';
import { PageTitle } from '@/app/_components/archive-ui';

/*
 * One left-aligned error state for every error and not-found file: the page
 * title, one sentence, the actions. Same heading as every page title, no
 * full-screen centring, so the title lines up with the brand and footer.
 */
const read = (file: string): string => readFileSync(path.join(process.cwd(), file), 'utf8');
const files = [
  'app/error.tsx',
  'app/dashboard/error.tsx',
  'app/dashboard/generator/error.tsx',
  'app/not-found.tsx',
  'app/global-error.tsx',
  'app/global-not-found.tsx',
];

const pageTitleClass = (): string => {
  const { container, unmount } = render(<PageTitle>x</PageTitle>);
  const value = container.querySelector('h1')?.className ?? '';
  unmount();
  return value;
};

describe('error state', () => {
  it.each(files)('%s uses the shared ErrorState, left-aligned and not full-screen', (file) => {
    const source = read(file);
    expect(source).toContain('<ErrorState');
    expect(source).not.toMatch(/text-center|min-h-screen|mx-auto|<h1/);
  });

  it('global-error loads the stylesheet and the font itself (it replaces the root layout)', () => {
    const source = read('app/global-error.tsx');
    expect(source).toContain("import './globals.css'");
    expect(source).toContain('fontVariables');
  });

  it.each([
    ['app/error', AppError],
    ['app/dashboard/error', DashboardError],
    ['app/dashboard/generator/error', GeneratorError],
  ])('%s renders a page title, one sentence and a retry', (_, Component) => {
    const reset = vi.fn();
    render(<Component error={new Error('x')} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1 }).className).toBe(pageTitleClass());
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('not-found renders a page title and the way home', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Página não encontrada');
    expect(screen.getByRole('heading', { level: 1 }).className).toBe(pageTitleClass());
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  });
});

describe('loading state', () => {
  it('draws a title, the field-of-sixty block and ruled rows, like the pages it stands for', () => {
    const { container } = render(<LoadingState title="Carregando dashboard" />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando dashboard');
    expect(screen.queryByRole('heading')).toBeNull();
    const field = container.querySelector('[data-loading="field"]');
    expect(field?.children).toHaveLength(60);
    expect(container.querySelectorAll('[data-loading="row"]').length).toBeGreaterThan(0);
  });
});
