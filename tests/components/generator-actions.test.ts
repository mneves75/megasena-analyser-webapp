import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateBets } from '@/app/dashboard/generator/actions';
import { fetchApi } from '@/lib/api/api-fetch';

vi.mock('@/lib/api/api-fetch', () => ({ fetchApi: vi.fn() }));
vi.mock('@/lib/api/forwarded-client-ip', () => ({ forwardedClientIpHeaders: async () => new Headers() }));

beforeEach(() => { vi.clearAllMocks(); });

describe('generator action expected errors', () => {
  it('returns the API error as serializable data for production RSC', async () => {
    vi.mocked(fetchApi).mockResolvedValue(Response.json({ error: 'Muitas requisições. Tente novamente.' }, { status: 429 }));
    await expect(generateBets(50, 'balanced', 'optimized')).resolves.toEqual({ error: 'Muitas requisições. Tente novamente.' });
  });

  it('does not expose an unexpected upstream body', async () => {
    vi.mocked(fetchApi).mockResolvedValue(new Response('internal-stack-details', { status: 502 }));
    await expect(generateBets(50, 'balanced', 'optimized')).resolves.toEqual({ error: 'Não foi possível gerar as apostas.' });
  });
});
