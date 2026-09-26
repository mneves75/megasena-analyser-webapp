/** IndexNow key format: 8–128 characters of A–Z, a–z, 0–9 and "-" (indexnow.org). */
export const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

/** The configured key, or null when INDEXNOW_KEY is missing or malformed. */
export function readIndexNowKey(): string | null {
  const key = (process.env['INDEXNOW_KEY'] ?? '').trim();
  return INDEXNOW_KEY_PATTERN.test(key) ? key : null;
}
