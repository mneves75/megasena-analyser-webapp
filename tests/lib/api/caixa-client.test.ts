import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaixaAPIClient } from '@/lib/api/caixa-client';

describe('CaixaAPIClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries on HTTP 500 and succeeds', async () => {
    const client = new CaixaAPIClient();
    const delaySpy = vi.spyOn(client as unknown as { delay: (ms: number) => Promise<void> }, 'delay');
    delaySpy.mockResolvedValue();

    const payload = {
      numero: 1,
      dataApuracao: '2020-01-01',
      listaDezenas: ['01', '02', '03', '04', '05', '06'],
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Internal Server Error' }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const data = await client.fetchDraw(1);

    expect(data.numero).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delaySpy).toHaveBeenCalled();
  });

  it('does not retry on non-retryable status', async () => {
    const client = new CaixaAPIClient();
    const delaySpy = vi.spyOn(client as unknown as { delay: (ms: number) => Promise<void> }, 'delay');
    delaySpy.mockResolvedValue();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 404, statusText: 'Not Found' })
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(client.fetchDraw(1)).rejects.toThrow('HTTP 404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(delaySpy).not.toHaveBeenCalled();
  });

  it('honors Retry-After header for backoff', async () => {
    const client = new CaixaAPIClient();
    const delaySpy = vi.spyOn(client as unknown as { delay: (ms: number) => Promise<void> }, 'delay');
    delaySpy.mockResolvedValue();

    const payload = {
      numero: 2,
      dataApuracao: '2020-02-02',
      listaDezenas: ['01', '02', '03', '04', '05', '06'],
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Retry-After': '2' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const data = await client.fetchDraw(2);

    expect(data.numero).toBe(2);
    expect(delaySpy).toHaveBeenCalledWith(2000);
  });
});
