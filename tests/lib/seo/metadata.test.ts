import { describe, expect, it } from 'vitest';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { BASE_URL } from '@/lib/constants';

/**
 * The archive and programmatic pages are the app's acquisition surface, and a
 * page that canonicalizes or shares to the wrong URL loses the ranking of every
 * URL below it. These assertions used to live only in the Playwright suite,
 * which no PR job runs.
 */
describe('buildPageMetadata', () => {
  it('points the canonical and og:url at the page itself', () => {
    const metadata = buildPageMetadata({
      path: '/concurso/3006',
      title: 'Resultado do concurso 3006',
      description: 'Dezenas sorteadas no concurso 3006.',
    });

    expect(metadata.alternates?.canonical).toBe(`${BASE_URL}/concurso/3006`);
    expect(metadata.openGraph?.url).toBe(`${BASE_URL}/concurso/3006`);
  });

  it('canonicalizes the home page without a trailing slash', () => {
    const metadata = buildPageMetadata({
      path: '/',
      title: 'Mega-Sena Analyzer',
      description: 'Estatísticas da Mega-Sena.',
    });

    expect(metadata.alternates?.canonical).toBe(BASE_URL);
    expect(metadata.openGraph?.url).toBe(BASE_URL);
  });

  it('always declares an explicit social image instead of inheriting a generic one', () => {
    const metadata = buildPageMetadata({
      path: '/numeros/7',
      title: 'Número 7',
      description: 'Frequência e atraso do número 7.',
    });

    const images = metadata.openGraph?.images;
    expect(Array.isArray(images)).toBe(true);
    expect(images).toEqual([
      expect.objectContaining({ url: `${BASE_URL}/opengraph-image`, width: 1200, height: 630 }),
    ]);
    expect(metadata.twitter?.images).toEqual([`${BASE_URL}/twitter-image`]);
  });

  it('keeps a page-specific social card and its alt text', () => {
    const metadata = buildPageMetadata({
      path: '/concurso/3006',
      title: 'Resultado do concurso 3006',
      description: 'Dezenas sorteadas no concurso 3006.',
      socialImages: {
        openGraph: '/concurso/3006/opengraph-image',
        twitter: '/concurso/3006/twitter-image',
        alt: 'Concurso 3006',
      },
    });

    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: `${BASE_URL}/concurso/3006/opengraph-image`,
        alt: 'Concurso 3006',
      }),
    ]);
    expect(metadata.twitter?.images).toEqual([`${BASE_URL}/concurso/3006/twitter-image`]);
  });

  it('drops the brand suffix only when the page title already carries its data', () => {
    const templated = buildPageMetadata({
      path: '/about',
      title: 'Sobre',
      description: 'Sobre o projeto.',
    });
    const absolute = buildPageMetadata({
      path: '/concurso/3006',
      title: 'Resultado do concurso 3006',
      description: 'Dezenas sorteadas no concurso 3006.',
      absoluteTitle: true,
    });

    expect(templated.title).toBe('Sobre');
    expect(templated.openGraph?.title).toMatch(/ \| /);
    expect(absolute.title).toEqual({ absolute: 'Resultado do concurso 3006' });
    expect(absolute.openGraph?.title).toBe('Resultado do concurso 3006');
  });
});
