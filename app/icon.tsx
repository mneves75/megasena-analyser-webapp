import { ImageResponse } from 'next/og';
import { IconCard } from '@/app/_lib/brand-image';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<IconCard dot={14} gap={6} />, { ...size });
}
