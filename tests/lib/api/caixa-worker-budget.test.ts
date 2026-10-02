// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaixaAPIClient } from '@/lib/api/caixa-client';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('bounded Worker CAIXA refresh budget', () => {
  it('caps upstream Retry-After and attempt count', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => new Response('unavailable', { status: 503, headers: { 'Retry-After': '86400' } }));
    vi.stubGlobal('fetch', fetch);
    const client = new CaixaAPIClient({ timeoutMs: 10000, maxRetries: 3, maxRetryDelayMs: 10000 });
    const failure = expect(client.fetchDraw()).rejects.toThrow(/503/);
    await vi.advanceTimersByTimeAsync(20000);
    await failure;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a stalled response including its body', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const client = new CaixaAPIClient({ timeoutMs: 10, maxRetries: 1, maxRetryDelayMs: 10 });
    const failure = expect(client.fetchDraw()).rejects.toThrow(/timeout after 10ms/);
    await vi.advanceTimersByTimeAsync(10);
    await failure;
    expect(vi.getTimerCount()).toBe(0);
  });
});
