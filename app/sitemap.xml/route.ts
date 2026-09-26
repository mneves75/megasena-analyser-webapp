import { ARCHIVE_DRIVEN_PATHS, EDITORIAL_PATHS } from '@/lib/seo/archive-paths';
import { absoluteUrl } from '@/lib/seo/metadata';
import { loadSitemapData } from '@/app/_lib/archive';

// Built per request from the archive so new draws appear without a deploy.
export const dynamic = 'force-dynamic';

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A route handler rather than app/sitemap.ts so the short Cloudflare edge TTL is
 * sent only with a real sitemap: if the archive API fails, Next answers a plain
 * 500 that Cloudflare does not cache.
 *
 * lastmod values come from the archive's load timestamps (`draw_changes` in
 * lib/analytics/draw-archive.ts), the same values the pages publish as JSON-LD
 * dateModified.
 */
export async function GET(): Promise<Response> {
  const { archive, draws, years } = await loadSitemapData();
  const entries: Array<[path: string, lastModified: string | null]> = [
    ...ARCHIVE_DRIVEN_PATHS.map((path): [string, string | null] => [path, archive.lastModified]),
    ...EDITORIAL_PATHS.map((path): [string, string | null] => [path, null]),
    ...years.map((year): [string, string | null] => [`/resultados/${year.year}`, year.lastModified]),
    ...Array.from({ length: 60 }, (_, index): [string, string | null] => [
      `/numeros/${index + 1}`,
      archive.lastModified,
    ]),
    ...draws.map((draw): [string, string | null] => [`/concurso/${draw.contestNumber}`, draw.lastModified]),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      ([path, lastModified]) =>
        `<url><loc>${escapeXml(absoluteUrl(path))}</loc>${
          lastModified ? `<lastmod>${lastModified}</lastmod>` : ''
        }</url>`
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      'Cloudflare-CDN-Cache-Control': 'max-age=600',
    },
  });
}
