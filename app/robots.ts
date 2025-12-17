import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
