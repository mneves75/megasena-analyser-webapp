import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/metadata';
import { loadSitemapData } from '@/app/_lib/archive';

// Built per request from the archive so new draws appear without a deploy.
export const dynamic = 'force-dynamic';

// Pages whose content changes whenever the archive changes.
const ARCHIVE_DRIVEN_PATHS = ['/', '/dashboard', '/dashboard/statistics', '/resultados', '/numeros'];
// Editorial pages: no lastmod rather than an invented one (Google ignores
// lastmod values that are not consistently accurate).
const EDITORIAL_PATHS = ['/dashboard/generator', '/about', '/terms', '/privacy', '/privacy/direitos'];

/**
 * lastmod values come from the archive's load timestamps (see `draw_changes` in
 * lib/analytics/draw-archive.ts), the same values the pages publish as JSON-LD
 * dateModified.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { archive, draws, years } = await loadSitemapData();
  const entry = (path: string, lastModified: string | null): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path),
    ...(lastModified ? { lastModified } : {}),
  });

  return [
    ...ARCHIVE_DRIVEN_PATHS.map((path) => entry(path, archive.lastModified)),
    ...EDITORIAL_PATHS.map((path) => entry(path, null)),
    ...years.map((year) => entry(`/resultados/${year.year}`, year.lastModified)),
    ...Array.from({ length: 60 }, (_, index) => entry(`/numeros/${index + 1}`, archive.lastModified)),
    ...draws.map((draw) => entry(`/concurso/${draw.contestNumber}`, draw.lastModified)),
  ];
}
