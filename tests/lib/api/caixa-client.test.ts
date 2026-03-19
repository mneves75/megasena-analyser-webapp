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

  it('normalizes the current CAIXA payload shape into the canonical draw contract', async () => {
    const client = new CaixaAPIClient();

    const payload = {
      numero: 2985,
      dataApuracao: '2026-03-17',
      listaDezenas: ['09', '31', '32', '40', '45', '55'],
      listaRateioPremio: [
        { descricaoFaixa: '6 acertos', faixa: 1, numeroDeGanhadores: 3, valorPremio: 34856052.53 },
        { descricaoFaixa: '5 acertos', faixa: 2, numeroDeGanhadores: 96, valorPremio: 34815.62 },
        { descricaoFaixa: '4 acertos', faixa: 3, numeroDeGanhadores: 4494, valorPremio: 1225.92 },
      ],
      valorArrecadado: 126007547.5,
      valorAcumuladoProximoConcurso: 12540698.04,
      valorEstimadoProximoConcurso: 3500000,
      acumulado: false,
      tipoJogo: 'MEGA_SENA',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const data = await client.fetchDraw(2985);

    expect(data.rateioProcessamento?.map((item) => item.descricaoFaixa)).toEqual([
      'Sena',
      'Quina',
      'Quadra',
    ]);
    expect(data.rateioProcessamento?.[0]?.valorPremio).toBe(34856052.53);
    expect(data.valorAcumuladoConcurso).toBe(12540698.04);
    expect(data.valorEstimadoProximoConcurso).toBe(3500000);
  });
});
