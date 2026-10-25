import { ImageResponse } from 'next/og';
import { SiteCard } from '@/app/_lib/brand-image';

export const alt = 'Mega-Sena Analyzer: resultados, estatísticas e gerador de apostas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(<SiteCard />, { ...size });
}
