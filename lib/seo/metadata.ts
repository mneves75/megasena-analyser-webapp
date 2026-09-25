import type { Metadata } from 'next';
import { APP_INFO, BASE_URL } from '@/lib/constants';

export function absoluteUrl(path: string): string {
  return path === '/' ? BASE_URL : `${BASE_URL}${path}`;
}

interface PageMetadataInput {
  /** Site-relative path; becomes the self-referencing canonical and og:url. */
  path: string;
  title: string;
  description: string;
  /**
   * Programmatic pages carry their own distinguishing data in the title, so the
   * brand suffix from the root template is dropped to keep them short.
   */
  absoluteTitle?: boolean;
  socialDescription?: string;
  /**
   * Page-specific social images (site-relative paths). Needed even when the
   * segment has its own opengraph-image file: the config value set here would
   * otherwise override it with the generic card.
   */
  socialImages?: { openGraph: string; twitter: string; alt: string };
}

/**
 * Every indexable page builds its metadata here so the canonical, og:url and
 * social cards always describe the page itself. The root layout deliberately
 * defines no canonical: a page that forgot one would otherwise canonicalize to
 * the home page.
 */
export function buildPageMetadata({
  path,
  title,
  description,
  absoluteTitle = false,
  socialDescription,
  socialImages,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const shareTitle = absoluteTitle ? title : `${title} | ${APP_INFO.NAME}`;
  const shareDescription = socialDescription ?? description;
  // A page-level openGraph object replaces the parent's, and the root
  // opengraph-image file is not re-applied to it, so the card is always explicit.
  const image = {
    url: absoluteUrl(socialImages?.openGraph ?? '/opengraph-image'),
    width: 1200,
    height: 630,
    alt: socialImages?.alt ?? `${APP_INFO.NAME}: resultados e estatísticas da Mega-Sena`,
  };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: APP_INFO.NAME,
      url,
      title: shareTitle,
      description: shareDescription,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDescription,
      images: [absoluteUrl(socialImages?.twitter ?? '/twitter-image')],
    },
  };
}
