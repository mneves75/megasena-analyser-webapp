// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ notFound: vi.fn(), permanentRedirect: vi.fn() }));

import { frequencyBand } from '@/app/_lib/format';

describe('frequencyBand', () => {
  it('splits the observed range into four equal bands, the maximum in the darkest', () => {
    expect([280, 299, 300, 319, 320, 339, 340, 359, 360].map((value) => frequencyBand(value, 280, 360))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 3,
    ]);
  });

  it('puts every number in the lightest band when all frequencies are equal', () => {
    expect(frequencyBand(5, 5, 5)).toBe(0);
  });
});
