// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildHealthUrl, validateHealthPayload } from '../../scripts/check-production-freshness';

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
