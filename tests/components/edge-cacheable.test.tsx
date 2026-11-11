import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EdgeCacheable } from '@/app/_components/edge-cacheable';
import { EDGE_CACHE_MARKER } from '@/lib/cloudflare/edge-cache';
import AppError from '@/app/error';
import DashboardError from '@/app/dashboard/error';
import NotFound from '@/app/not-found';
import HomeLoading from '@/app/(home)/loading';
import DashboardLoading from '@/app/dashboard/loading';
import StatisticsLoading from '@/app/dashboard/statistics/loading';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const MARKER_SELECTOR = '[data-edge-cache="complete"]';

describe('EdgeCacheable completeness marker', () => {
  it('serializes to the exact string the edge cache looks for: hidden, empty, no style', () => {
    const html = renderToStaticMarkup(<EdgeCacheable />);
    expect(html).toBe('<div hidden="" data-edge-cache="complete"></div>');
    expect(html.split(EDGE_CACHE_MARKER)).toHaveLength(2);
    expect(html).not.toContain('style=');
  });

  it.each([
    ['app/error.tsx', () => <AppError error={new Error('x')} reset={() => {}} />],
    ['app/dashboard/error.tsx', () => <DashboardError error={new Error('x')} reset={() => {}} />],
    ['app/not-found.tsx', () => <NotFound />],
    ['app/(home)/loading.tsx', () => <HomeLoading />],
    ['app/dashboard/loading.tsx', () => <DashboardLoading />],
    ['app/dashboard/statistics/loading.tsx', () => <StatisticsLoading />],
  ])('%s never emits the marker', (_name, element) => {
    const { container } = render(element());
    expect(container.querySelector(MARKER_SELECTOR)).toBeNull();
  });

  // Pages whose marker is unconditional: their loaders throw instead of degrading,
  // so a rendered page always came from data fetched in this request.
  it.each([
    'app/resultados/page.tsx',
    'app/numeros/page.tsx',
    'app/mega-da-virada/page.tsx',
    'app/concurso/[numero]/page.tsx',
    'app/numeros/[numero]/page.tsx',
    'app/resultados/[ano]/page.tsx',
  ])('%s renders the marker once', (file) => {
    expect(readFileSync(file, 'utf8').match(/<EdgeCacheable \/>/g)).toHaveLength(1);
  });

  it.each(['app/dashboard/generator/page.tsx', 'app/about/page.tsx', 'app/privacy/page.tsx', 'app/terms/page.tsx'])(
    '%s stays outside the edge cache and renders no marker', (file) => {
      expect(readFileSync(file, 'utf8')).not.toContain('EdgeCacheable');
    }
  );
});
