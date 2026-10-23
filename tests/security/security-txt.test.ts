// @vitest-environment node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;
// RFC 9116 §2.5.5 recommends Expires less than a year ahead; the 90-day floor
// makes CI ask for renewal before scanners start treating the file as stale.
const RENEWAL_WINDOW_DAYS = 90;

describe('security.txt', () => {
  it('tem contato e Expires dentro da janela do RFC 9116', async () => {
    const body = await readFile(path.join(process.cwd(), 'public/.well-known/security.txt'), 'utf8');
    expect(body).toMatch(/^Contact: mailto:\S+@megasena-analyzer\.com\.br$/m);

    const expires = body.match(/^Expires: (\S+)$/m)?.[1];
    expect(expires, 'Expires ausente').toBeDefined();
    const daysLeft = (Date.parse(expires!) - Date.now()) / DAY_MS;

    expect(daysLeft, 'renovar Expires do security.txt').toBeGreaterThan(RENEWAL_WINDOW_DAYS);
    expect(daysLeft, 'Expires deve ficar a menos de um ano').toBeLessThan(365);
  });
});
