import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const HMAC_ALGORITHM = 'sha256';
const SALT_ROTATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SALT_ROTATION_EPOCH_MS = Date.parse('2026-01-01T00:00:00.000Z');

function getSecret(): string | null {
  const secret = process.env['IP_HASH_SECRET'];
  if (!secret) {
    return null;
  }

  const trimmed = secret.trim();
  if (trimmed.length < 32) {
    return null;
  }

  return trimmed;
}

function currentSaltWindowId(now: number): number {
  return Math.max(0, Math.floor((now - SALT_ROTATION_EPOCH_MS) / SALT_ROTATION_WINDOW_MS));
}

/**
 * Pseudonym for a client network (`rateLimitSubject`: IPv4 address or IPv6
 * /64). It keys the rate limit and is the audited `client_id_hash`. With a
 * strong secret it is an HMAC whose 30-day window limits long-term linkage;
 * without one it uses the caller's random per-process salt, never a plain
 * SHA-256, which is reversible over the IPv4 space.
 */
export function pseudonymizeClient(
  subject: string,
  secret: string | undefined,
  fallbackSalt: Uint8Array,
  now: number = Date.now()
): string {
  const trimmed = secret?.trim();
  if (!trimmed || trimmed.length < 32) {
    return `salted-sha256:${createHmac(HMAC_ALGORITHM, fallbackSalt).update(subject).digest('hex')}`;
  }
  const windowId = currentSaltWindowId(now);
  return `hmac-sha256:v1:${windowId}:${createHmac(HMAC_ALGORITHM, trimmed).update(`v1:${windowId}:${subject}`).digest('hex')}`;
}

export function hashForAudit(value: string, maxLength: number = 500): string {
  const truncated = value.length > maxLength ? value.slice(0, maxLength) : value;
  return `sha256:${createHash('sha256').update(truncated).digest('hex')}`;
}

export function safeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.byteLength !== bBuf.byteLength) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function isHmacEnabled(): boolean {
  return getSecret() !== null;
}
