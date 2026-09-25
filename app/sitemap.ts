import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/metadata';
import { loadSitemapData } from '@/app/_lib/archive';

// Built per request from the archive so new draws appear without a deploy.
export const dynamic = 'force-dynamic';

// Pages whose content changes with every new draw.
const DRAW_DRIVEN_PATHS = ['/', '/dashboard', '/dashboard/statistics', '/resultados', '/numeros'];
// Editorial pages: no lastmod rather than an invented one (Google ignores
// lastmod values that are not consistently accurate).
const EDITORIAL_PATHS = ['/dashboard/generator', '/about', '/terms', '/privacy', '/privacy/direitos'];

/**
 * lastmod is the last date a page's content or links changed:
 * - a draw page changes when the next draw adds its "Próximo concurso" link;
 * - a year page changes with its last draw, then when the next year starts;
 * - number pages and hubs change with every draw.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { lastDrawDate, draws, years } = await loadSitemapData();
  const dated = (path: string, date: string | null): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path),
    ...(date ? { lastModified: date } : {}),
  });

  return [
    ...DRAW_DRIVEN_PATHS.map((path) => dated(path, lastDrawDate)),
    ...EDITORIAL_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    // Years arrive newest first, so the following year is the previous entry.
    ...years.map((summary, index) =>
      dated(`/resultados/${summary.year}`, years[index - 1]?.firstDrawDate ?? summary.lastDrawDate)
    ),
    ...Array.from({ length: 60 }, (_, index) => dated(`/numeros/${index + 1}`, lastDrawDate)),
    // Draws arrive oldest first, so the next draw is the following entry.
    ...draws.map((draw, index) =>
      dated(`/concurso/${draw.contestNumber}`, draws[index + 1]?.drawDate ?? draw.drawDate)
    ),
  ];
}
