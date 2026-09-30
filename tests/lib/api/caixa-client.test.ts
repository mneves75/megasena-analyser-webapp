import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaixaAPIClient } from '@/lib/api/caixa-client';

describe('CaixaAPIClient', () => {
  it('keeps the request deadline active while a response body is stalled', async () => {
    const client = new CaixaAPIClient();
    Object.assign(client, { timeout: 25 });
    vi.spyOn(client as unknown as { delay: (ms: number) => Promise<void> }, 'delay').mockResolvedValue();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          options.signal?.addEventListener('abort', () =>
            controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
        },
      });
      return Promise.resolve(new Response(body));
    }));
    const outcome = await Promise.race([
      client.fetchDraw(1).then(() => 'unexpected success', (error: unknown) =>
        error instanceof Error ? error.message : String(error)),
      new Promise<string>((resolve) => setTimeout(() => resolve('deadline did not fire'), 500)),
    ]);
    expect(outcome).toContain('Request timeout after 25ms');
  });
  it('preserves the normalized special draw through an ETag 304 response', async () => {
    const client = new CaixaAPIClient();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        numero: 3010,
        dataApuracao: '24/05/2026',
        listaDezenas: ['01', '02', '03', '04', '05', '06'],
        indicadorConcursoEspecial: 2,
      }), { headers: { ETag: 'special-draw' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 })));
    const first = await client.fetchDraw(3010);
    const second = await client.fetchDraw(3010);
    expect(first.concursoEspecial).toBe(true);
    expect(second).toEqual(first);
  });
  it('uses listaRateioPremio when the legacy prize array is empty', async () => {
    const client = new CaixaAPIClient();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      numero: 3064,
      dataApuracao: '29/09/2026',
      listaDezenas: ['04', '10', '20', '25', '27', '48'],
      rateioProcessamento: [],
      listaRateioPremio: [{ faixa: 2, numeroDeGanhadores: 82, valorPremio: 24039.44 }],
    }))));
    const draw = await client.fetchDraw(3064);
    expect(draw.rateioProcessamento).toEqual([
      { descricaoFaixa: 'Quina', numeroDeGanhadores: 82, valorPremio: 24039.44 },
    ]);
  });
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

  it.each([
    [2, true],
    [1, false],
  ])(
    'reads indicadorConcursoEspecial %i as concursoEspecial %s (tipoJogo is always MEGA_SENA)',
    async (indicator, special) => {
      const client = new CaixaAPIClient();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              numero: 2810,
              dataApuracao: '31/12/2024',
              listaDezenas: ['01', '17', '19', '29', '50', '57'],
              listaRateioPremio: [],
              tipoJogo: 'MEGA_SENA',
              indicadorConcursoEspecial: indicator,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      const data = await client.fetchDraw(2810);

      expect(data.concursoEspecial).toBe(special);
    }
  );

  it('rejects a response for a different contest without retrying', async () => {
    const client = new CaixaAPIClient();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          numero: 1,
          dataApuracao: '2020-01-01',
          listaDezenas: ['01', '02', '03', '04', '05', '06'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(client.fetchDraw(999)).rejects.toThrow(
      /solicitado.*999.*recebido.*1/i
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed listaDezenas without retrying', async () => {
    const client = new CaixaAPIClient();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          numero: 1,
          dataApuracao: '2020-01-01',
          listaDezenas: ['01', '02', '03', '04', '05'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(client.fetchDraw(1)).rejects.toThrow(/listaDezenas/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicated dezenas without retrying', async () => {
    const client = new CaixaAPIClient();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          numero: 1,
          dataApuracao: '2020-01-01',
          listaDezenas: ['01', '02', '03', '04', '05', '05'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(client.fetchDraw(1)).rejects.toThrow(/distintas|duplic/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid prize tier numbers without retrying', async () => {
    const client = new CaixaAPIClient();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          numero: 1,
          dataApuracao: '2020-01-01',
          listaDezenas: ['01', '02', '03', '04', '05', '06'],
          listaRateioPremio: [
            {
              faixa: 1,
              numeroDeGanhadores: 1,
              valorPremio: -1,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(client.fetchDraw(1)).rejects.toThrow(/valorPremio/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails full-range ingestion when any contest cannot be fetched', async () => {
    const client = new CaixaAPIClient();
    const delaySpy = vi.spyOn(client as unknown as { delay: (ms: number) => Promise<void> }, 'delay');
    delaySpy.mockResolvedValue();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            numero: 1,
            dataApuracao: '2020-01-01',
            listaDezenas: ['01', '02', '03', '04', '05', '06'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }));

    vi.stubGlobal('fetch', fetchMock);

    await expect(client.fetchAllDraws(1, 2)).rejects.toThrow(/complete draw range/);
  });
});
