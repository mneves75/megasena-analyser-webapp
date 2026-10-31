import { describe, expect, it, vi } from 'vitest';

const archivo = vi.fn((options: Record<string, unknown>) => ({ variable: `variable-${String(options['variable'])}` }));
vi.mock('next/font/google', () => ({ Archivo: archivo }));

describe('Archivo font loading', () => {
  it('preloads only the latin file; other subsets stay declared and load by unicode-range', async () => {
    const { fontVariables } = await import('@/app/_lib/fonts');
    expect(archivo).toHaveBeenCalledTimes(1);
    // vinext and Next.js emit every @font-face from the Google CSS and use
    // `subsets` only to choose preloads. No page text needs latin-ext, so its
    // 86 KB preload was a wasted request on every first visit.
    expect(archivo.mock.calls[0]![0]).toEqual({
      subsets: ['latin'],
      display: 'swap',
      axes: ['wdth'],
      variable: '--font-archivo',
    });
    expect(fontVariables).toBe('variable---font-archivo');
  });
});
