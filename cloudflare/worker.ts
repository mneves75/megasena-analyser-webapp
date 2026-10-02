import { env } from 'cloudflare:workers';
import app from 'vinext/server/app-router-entry';
import type { MegaSenaData } from './data-object';

export { MegaSenaData } from './data-object';

interface WorkerEnv {
  DATA: DurableObjectNamespace<MegaSenaData>;
  ASSETS: Fetcher;
  DEPLOYMENT_STAGE?: string;
}

function database() {
  const namespace = (env as unknown as WorkerEnv).DATA;
  return namespace.get(namespace.idFromName('megasena'));
}

const worker = {
  async fetch(request: Request, workerEnv: WorkerEnv, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // Missing or unrecognized stage must not make a candidate indexable.
    const preventIndexing = workerEnv.DEPLOYMENT_STAGE !== 'production';
    if (preventIndexing && url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /\n', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
      });
    }
    const response = url.pathname.startsWith('/api/')
      ? await database().handle(request, {
        internal: false,
        clientIp: request.headers.get('cf-connecting-ip'),
        secure: url.protocol === 'https:',
      })
      : await app.fetch(request, env as unknown as WorkerEnv, context);
    if (!preventIndexing) return response;
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow');
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
