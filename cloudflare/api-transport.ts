import { env } from 'cloudflare:workers';
import type { ServerApiTransport } from '../lib/api/runtime-api-transport';
import type { MegaSenaData } from './data-object';

export function getServerApiTransport(): ServerApiTransport {
  return async (request) => {
    if (!new URL(request.url).pathname.startsWith('/api/')) {
      throw new Error('Private API transport only accepts /api/ routes.');
    }
    const namespace = (env as unknown as { DATA: DurableObjectNamespace<MegaSenaData> }).DATA;
    request.signal.throwIfAborted();
    // Workers RPC cannot serialize an explicit AbortSignal without an experimental
    // flag. Keep the deadline at the caller and transfer the HTTP body separately.
    const detached = new Request(request.url, {
      method: request.method, headers: request.headers, body: request.body,
    });
    let rejectAbort: (reason: unknown) => void = () => {};
    const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(request.signal.reason);
    request.signal.addEventListener('abort', onAbort, { once: true });
    try {
      return await Promise.race([
        namespace.get(namespace.idFromName('megasena')).handle(detached, {
          internal: true,
          clientIp: request.headers.get('cf-connecting-ip'),
          secure: true,
        }),
        aborted,
      ]);
    } finally {
      request.signal.removeEventListener('abort', onAbort);
    }
  };
}
