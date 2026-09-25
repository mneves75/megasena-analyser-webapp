import type { MetadataRoute } from 'next';
import { BASE_URL as baseUrl } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // `/_next/` must stay crawlable: it serves the JS and CSS Googlebot needs to render pages.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
