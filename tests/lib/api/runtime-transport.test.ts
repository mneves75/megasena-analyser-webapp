import { afterEach, describe, expect, it, vi } from 'vitest';

const bindingFetch = vi.hoisted(() => vi.fn(async (_request: Request) => Response.json({ binding: true })));
vi.mock('@/lib/api/runtime-api-transport', () => ({ getServerApiTransport: () => bindingFetch }));

import { fetchApi } from '@/lib/api/api-fetch';

describe('API runtime transport', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it('uses the private binding for server calls without forwarding the loopback secret', async () => {
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    vi.stubEnv('INTERNAL_API_SECRET', 'test-only-internal-secret-at-least-32-characters');
    const response = await fetchApi('/api/health', {}, 'server');
    expect(await response.json()).toEqual({ binding: true });
    expect(network).not.toHaveBeenCalled();
    expect(bindingFetch).toHaveBeenCalledOnce();
    const request = bindingFetch.mock.calls[0]![0];
    expect(new URL(request.url).pathname).toBe('/api/health');
    expect(request.headers.has('X-Megasena-Internal-Request-Secret')).toBe(false);
  });

  it('keeps browser requests on the public same-origin API', async () => {
    const network = vi.fn(async () => Response.json({ public: true }));
    vi.stubGlobal('fetch', network);
    const response = await fetchApi('/api/health', {}, 'client');
    expect(await response.json()).toEqual({ public: true });
    expect(network.mock.calls[0]![0]).toBe('/api/health');
    expect(bindingFetch).not.toHaveBeenCalled();
  });
});
