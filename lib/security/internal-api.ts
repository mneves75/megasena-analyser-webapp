import { timingSafeEqual } from 'node:crypto';

const INTERNAL_REQUEST_HEADER = 'x-megasena-internal-request';
const INTERNAL_REQUEST_SECRET_HEADER = 'x-megasena-internal-request-secret';
const MIN_INTERNAL_SECRET_LENGTH = 32;

// Defense-in-depth only: behind a same-host reverse proxy every proxied request
// arrives with a loopback peer, so this check contributes nothing there. The
// real gate is the >=32-char secret compared in constant time below — treat the
// loopback requirement as a bonus for direct-exposure setups, never as the auth.
function isLoopbackPeer(address: string | null): boolean {
  if (!address) {
    return false;
  }

  const normalized = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
  return normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
}

function hasValidInternalApiSecret(req: Request, configuredSecret: string): boolean {
  const secret = configuredSecret.trim();
  if (secret.length < MIN_INTERNAL_SECRET_LENGTH) {
    return false;
  }

  const candidate = req.headers.get(INTERNAL_REQUEST_SECRET_HEADER)?.trim();
  if (!candidate || candidate.length !== secret.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(candidate), Buffer.from(secret));
}

export function isInternalApiRequest(
  req: Request,
  peerAddress: string | null,
  configuredSecret = process.env['INTERNAL_API_SECRET'] ?? ''
): boolean {
  return (
    req.headers.get(INTERNAL_REQUEST_HEADER) === '1' &&
    isLoopbackPeer(peerAddress) &&
    hasValidInternalApiSecret(req, configuredSecret)
  );
}
