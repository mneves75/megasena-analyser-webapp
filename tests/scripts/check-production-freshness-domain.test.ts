// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/site-domains.json', () => ({
  default: { primaryDomain: 'canonical.example', redirectDomains: [] },
}));

const script = await import('../../scripts/check-production-freshness');

describe('scripts/check-production-freshness.ts default target', () => {
  it('reads the canonical host from lib/site-domains.json', () => {
    expect(script.DEFAULT_BASE_URL).toBe('https://canonical.example');
  });
});
