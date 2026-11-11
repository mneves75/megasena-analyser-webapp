import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DrawsTable } from '@/app/_components/archive-ui';

/*
 * One "Fonte: CAIXA Econômica Federal" line per page, in the page header next
 * to the freshness statement, instead of one under every table and figure.
 */
const sourceMentions = (file: string): number => {
  const source = readFileSync(path.join(process.cwd(), file), 'utf8');
  return (
    (source.match(/<SourceLine\b/g)?.length ?? 0) +
    (source.match(/<ArchiveFreshness\b/g)?.length ?? 0) +
    (source.match(/Fonte: CAIXA/g)?.length ?? 0)
  );
};

describe('source line', () => {
  it.each([
    'app/(home)/page.tsx',
    'app/dashboard/page.tsx',
    'app/resultados/page.tsx',
    'app/resultados/[ano]/page.tsx',
    'app/concurso/[numero]/page.tsx',
    'app/numeros/page.tsx',
    'app/numeros/[numero]/page.tsx',
    'app/mega-da-virada/page.tsx',
  ])('%s states its source exactly once', (file) => {
    expect(sourceMentions(file)).toBe(1);
  });

  it('a draws table renders its rows and carries no source line of its own', () => {
    const draw = (contestNumber: number) => ({
      contestNumber,
      drawDate: '2026-05-12',
      numbers: [2, 10, 18, 26, 34, 52],
      sena: { winners: 0, prize: 0 },
      quina: { winners: 10, prize: 1000 },
      quadra: { winners: 100, prize: 100 },
      accumulated: true,
      accumulatedValue: null,
      nextEstimatedPrize: null,
      totalCollection: null,
    });
    render(<DrawsTable caption="Concursos" draws={[draw(3006), draw(3005)]} />);
    const table = screen.getByRole('table', { name: 'Concursos' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    rows.forEach((row, index) => {
      const contest = 3006 - index;
      expect(within(row).getByRole('link', { name: String(contest) })).toHaveAttribute(
        'href',
        `/concurso/${contest}`
      );
    });
    expect(screen.queryByText(/Fonte:/)).not.toBeInTheDocument();
  });
});
