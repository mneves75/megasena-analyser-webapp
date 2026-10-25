import { notFound, permanentRedirect } from 'next/navigation';
import { parseCanonicalInteger } from '@/lib/api/archive-contract';

/**
 * Resolves an integer route segment. Zero-padded aliases ("03006") redirect
 * permanently to the canonical form; anything else invalid is a hard 404.
 * The status stays settable because archive routes have no Suspense boundary
 * above them (see app/(home)/loading.tsx); keep it that way.
 */
export function resolveIntegerParam(
  raw: string,
  min: number,
  max: number,
  canonicalPath: (value: number) => string
): number {
  const value = parseCanonicalInteger(raw, min, max);
  if (value !== null) {
    return value;
  }
  // `0+` and `[1-9]` cannot overlap, so a long zero run fails in linear time.
  if (/^0+[1-9]\d*$/.test(raw)) {
    const unpadded = parseCanonicalInteger(raw.replace(/^0+/, ''), min, max);
    if (unpadded !== null) {
      permanentRedirect(canonicalPath(unpadded));
    }
  }
  notFound();
}
