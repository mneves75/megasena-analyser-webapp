import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('a draws table carries no source line of its own', () => {
    render(<DrawsTable caption="Concursos" draws={[]} />);
    expect(screen.queryByText(/Fonte:/)).not.toBeInTheDocument();
  });
});
