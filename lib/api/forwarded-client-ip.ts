import { headers } from 'next/headers';
import { configuredClientIpHeaders } from '@/lib/security/http';

/**
 * Copies the client IP headers the Bun API trusts from the page request, verbatim.
 *
 * Server-side calls reach the API from loopback, so without these headers every
 * visitor shares the 127.0.0.1 rate-limit bucket (or, with INTERNAL_API_SECRET,
 * is not metered at all). Forwarding them grants no new trust: the /api/* rewrite
 * already forwards browser headers unchanged, and the API applies the same
 * TRUST_PROXY_HEADERS / trusted-peer rules to both paths.
 */
export function pickClientIpHeaders(incoming: Headers): Headers {
  const forwarded = new Headers();
  for (const name of configuredClientIpHeaders()) {
    const value = incoming.get(name);
    if (value !== null) {
      forwarded.set(name, value);
    }
  }
  return forwarded;
}

// Each server-side caller passes this explicitly instead of fetchApi reading it:
// fetchApi is shared with client components, and next/headers cannot enter the
// client bundle. Deploy note: this runs in the Next process, so a pinned
// TRUSTED_CLIENT_IP_HEADER must be set there as well as on the Bun API.
export async function forwardedClientIpHeaders(): Promise<Headers> {
  return pickClientIpHeaders(await headers());
}
