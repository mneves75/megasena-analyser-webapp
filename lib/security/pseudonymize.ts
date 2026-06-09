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

function currentSaltWindowId(now: number = Date.now()): number {
  const elapsed = now - SALT_ROTATION_EPOCH_MS;
  if (elapsed < 0) {
    return 0;
  }
  return Math.floor(elapsed / SALT_ROTATION_WINDOW_MS);
}

export function pseudonymizeIp(value: string, now: number = Date.now()): string {
  if (!value) {
    return 'sha256:unknown';
  }

  const secret = getSecret();
  if (!secret) {
    return `sha256:${createHash('sha256').update(value).digest('hex')}`;
  }

  const windowId = currentSaltWindowId(now);
  const digest = createHmac(HMAC_ALGORITHM, secret)
    .update(`v1:${windowId}:${value}`)
    .digest('hex');
  return `hmac-sha256:v1:${windowId}:${digest}`;
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
  return timingSafeEqual(aBuf, bBuf);
}

export function isHmacEnabled(): boolean {
  return getSecret() !== null;
}
