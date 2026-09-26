/** Pages whose content changes whenever the archive changes (a new or corrected draw). */
export const ARCHIVE_DRIVEN_PATHS = [
  '/',
  '/dashboard',
  '/dashboard/statistics',
  '/resultados',
  '/numeros',
] as const;

/**
 * Editorial pages: listed in the sitemap without lastmod, because Google ignores
 * lastmod values that are not consistently accurate.
 */
export const EDITORIAL_PATHS = [
  '/dashboard/generator',
  '/about',
  '/terms',
  '/privacy',
  '/privacy/direitos',
] as const;
