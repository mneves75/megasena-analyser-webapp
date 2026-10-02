import { env } from 'cloudflare:workers';
import app from 'vinext/server/app-router-entry';
import type { MegaSenaData } from './data-object';
import { HSTS_HEADER_VALUE } from '../lib/security/csp';
import { BASE_URL } from '../lib/constants';
import siteDomains from '../lib/site-domains.json';

export { MegaSenaData } from './data-object';

interface WorkerEnv {
  DATA: DurableObjectNamespace<MegaSenaData>;
  ASSETS: Fetcher;
  DEPLOYMENT_STAGE?: string;
  ENVIRONMENT?: string;
}

function database() {
  const namespace = (env as unknown as WorkerEnv).DATA;
  return namespace.get(namespace.idFromName('megasena'));
}

function canonicalRedirect(url: URL): Response {
  const target = new URL(BASE_URL);
  // Assigning the path separately prevents //host paths from changing authority.
  target.pathname = url.pathname;
  target.search = url.search;
  return Response.redirect(target.href, 301);
}

const worker = {
  async fetch(request: Request, workerEnv: WorkerEnv, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // Missing or unrecognized stage must not make a candidate indexable.
    const preventIndexing = workerEnv.DEPLOYMENT_STAGE !== 'production';
    // The Worker receives the edge's actual URL; forwarded headers cannot assert TLS.
    const secure = workerEnv.ENVIRONMENT === 'production' && url.protocol === 'https:';
    const response = !preventIndexing && siteDomains.redirectDomains.includes(url.hostname)
      ? canonicalRedirect(url)
      : preventIndexing && url.pathname === '/robots.txt'
      ? new Response('User-agent: *\nDisallow: /\n', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
      : url.pathname.startsWith('/api/')
      ? await database().handle(request, {
        internal: false,
        clientIp: request.headers.get('cf-connecting-ip'),
        secure: url.protocol === 'https:',
      })
      : await app.fetch(request, env as unknown as WorkerEnv, context);
    if (!preventIndexing && !secure) return response;
    const headers = new Headers(response.headers);
    if (preventIndexing) headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (secure) headers.set('Strict-Transport-Security', HSTS_HEADER_VALUE);
    return new Response(response.body, {
      status: response.status, statusText: response.statusText, headers,
    });
  },
  async scheduled(): Promise<void> {
    const result = await database().refresh();
    console.info('caixa.daily_refresh', result);
    if (result.status !== 'success') throw new Error('CAIXA catch-up pending; retry alarm scheduled.');
  },
};

export default worker;
