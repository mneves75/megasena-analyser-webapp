import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date('2025-12-29'),
    },
    {
      url: `${BASE_URL}/dashboard`,
      lastModified: new Date('2026-03-18'),
    },
    {
      url: `${BASE_URL}/dashboard/generator`,
      lastModified: new Date('2025-12-29'),
    },
    {
      url: `${BASE_URL}/dashboard/statistics`,
      lastModified: new Date('2026-03-18'),
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date('2026-03-18'),
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date('2025-12-03'),
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date('2025-12-03'),
    },
  ];
}
