import { ImageResponse } from 'next/og';
import { IconCard } from '@/app/_lib/brand-image';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<IconCard dot={36} gap={14} />, { ...size });
}
