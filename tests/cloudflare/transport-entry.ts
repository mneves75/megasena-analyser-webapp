import { DurableObject } from 'cloudflare:workers';
import { getServerApiTransport } from '../../cloudflare/api-transport';

export class TransportData extends DurableObject {
  async handle(request: Request, peer: unknown): Promise<Response> {
    if (new URL(request.url).pathname.endsWith('/slow')) await new Promise(resolve => setTimeout(resolve, 100));
    return Response.json({ peer, body: await request.text() });
  }
}

const worker = {
  async fetch(): Promise<Response> {
    const transport = getServerApiTransport();
    const controller = new AbortController();
    const response = await transport(new Request('https://private/api/generate-bets', {
      method: 'POST', body: '{"budget":50.5}', signal: controller.signal,
      headers: { 'cf-connecting-ip': '192.0.2.1' },
    }));
    const result = await response.json() as { peer: unknown; body: string };
    if (JSON.stringify(result.peer) !== '{"clientIp":"192.0.2.1","secure":true}' || result.body !== '{"budget":50.5}') throw new Error(`RPC request changed: ${JSON.stringify(result.peer)}`);
    // No forwarded IP: the peer is not marked internal, so the limiter meters it as unknown.
    const anonymous = await (await transport(new Request('https://private/api/health'))).json() as { peer: unknown };
    if (JSON.stringify(anonymous.peer) !== '{"clientIp":null,"secure":true}') throw new Error(`Header-less SSR call must not be internal: ${JSON.stringify(anonymous.peer)}`);
    const timeout = new AbortController();
    const pending = transport(new Request('https://private/api/slow', { signal: timeout.signal }));
    timeout.abort(new Error('timeout control'));
    try { await pending; throw new Error('Timeout was ignored.'); }
    catch (error) { if (!(error instanceof Error) || error.message !== 'timeout control') throw error; }
    return Response.json({ passed: true, bodyPreserved: true, timeoutRejected: true });
  },
};
export default worker;
