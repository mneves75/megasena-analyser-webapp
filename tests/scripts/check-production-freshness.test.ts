// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildHealthUrl,
  checkProductionFreshness,
  validateHealthPayload,
} from '../../scripts/check-production-freshness';

describe('scripts/check-production-freshness.ts', () => {
  it('normaliza a URL pública para /api/health', () => {
    expect(buildHealthUrl('https://example.com/dashboard?x=1#hash')).toBe(
      'https://example.com/api/health'
    );
  });

  it('aceita payload saudável com versão esperada', () => {
    expect(
      validateHealthPayload(
        {
          status: 'healthy',
          version: '1.2.3',
          database: {
            connected: true,
            totalDraws: 3007,
            lastContestNumber: 3007,
            lastDrawDate: '2026-05-24',
          },
        },
        '1.2.3',
        { now: new Date('2026-05-26T00:00:00Z') }
      )
    ).toMatchObject({
      observedVersion: '1.2.3',
      totalDraws: 3007,
      lastContestNumber: 3007,
      lastDrawDate: '2026-05-24',
    });
  });

  it('falha quando produção está em versão antiga', () => {
    expect(() =>
      validateHealthPayload(
        {
          status: 'healthy',
          version: '1.2.2',
          database: {
            connected: true,
            totalDraws: 3007,
            lastContestNumber: 3007,
            lastDrawDate: '2026-05-24',
          },
        },
        '1.2.3',
        { now: new Date('2026-05-26T00:00:00Z') }
      )
    ).toThrow('Produção está desatualizada');
  });

  it('falha quando o banco não está conectado', () => {
    expect(() =>
      validateHealthPayload(
        {
          status: 'healthy',
          version: '1.2.3',
          database: {
            connected: false,
            totalDraws: 3007,
            lastContestNumber: 3007,
            lastDrawDate: '2026-05-24',
          },
        },
        '1.2.3',
        { now: new Date('2026-05-26T00:00:00Z') }
      )
    ).toThrow('banco');
  });

  it('falha quando a produção tem poucos concursos', () => {
    expect(() =>
      validateHealthPayload(
        {
          status: 'healthy',
          version: '1.2.3',
          database: {
            connected: true,
            totalDraws: 10,
            lastContestNumber: 10,
            lastDrawDate: '2026-05-24',
          },
        },
        '1.2.3',
        { minTotalDraws: 3000, now: new Date('2026-05-26T00:00:00Z') }
      )
    ).toThrow('incompleto');
  });

  it('falha quando a produção está com dados antigos', () => {
    expect(() =>
      validateHealthPayload(
        {
          status: 'healthy',
          version: '1.2.3',
          database: {
            connected: true,
            totalDraws: 3007,
            lastContestNumber: 3007,
            lastDrawDate: '2026-04-01',
          },
        },
        '1.2.3',
        { maxDrawAgeDays: 21, now: new Date('2026-05-26T00:00:00Z') }
      )
    ).toThrow('stale');
  });
});

describe('checkProductionFreshness cache-busting', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bypassa cache de CDN com cache-buster e headers no-cache, mantendo a URL exibida limpa', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchMock = vi.fn(async (input: unknown, init?: { headers?: Record<string, string> }) => {
      seen.push({ url: String(input), headers: init?.headers ?? {} });
      return new Response(
        JSON.stringify({
          status: 'healthy',
          version: '9.9.9',
          database: {
            connected: true,
            totalDraws: 3100,
            lastContestNumber: 3100,
            lastDrawDate: today,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkProductionFreshness({
      baseUrl: 'https://example.com',
      expectedVersion: '9.9.9',
      timeoutMs: 5000,
      minTotalDraws: 3000,
      maxDrawAgeDays: 21,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seen[0].url).toContain('/api/health');
    expect(seen[0].url).toContain('cb=');
    expect(seen[0].headers['cache-control']).toBe('no-cache');
    // URL exibida permanece canônica (sem query), apenas o fetch leva o buster.
    expect(result.healthUrl).toBe('https://example.com/api/health');
    expect(result.observedVersion).toBe('9.9.9');
  });
});
