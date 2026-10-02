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
    const result = await response.json() as { peer: { internal: boolean; clientIp: string }; body: string };
    if (!result.peer.internal || result.peer.clientIp !== '192.0.2.1' || result.body !== '{"budget":50.5}') throw new Error('RPC request changed.');
    const timeout = new AbortController();
    const pending = transport(new Request('https://private/api/slow', { signal: timeout.signal }));
    timeout.abort(new Error('timeout control'));
    try { await pending; throw new Error('Timeout was ignored.'); }
    catch (error) { if (!(error instanceof Error) || error.message !== 'timeout control') throw error; }
    return Response.json({ passed: true, bodyPreserved: true, timeoutRejected: true });
  },
};
export default worker;
