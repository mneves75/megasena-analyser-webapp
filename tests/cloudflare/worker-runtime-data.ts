import { DurableObject } from 'cloudflare:workers';

export class MegaSenaData extends DurableObject {
  handle(request: Request, peer: { internal: boolean }): Response {
    if (peer.internal) throw new Error('Public requests must remain external');
    return Response.json({ success: true, route: new URL(request.url).pathname }, {
      headers: { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'" },
    });
  }
  refresh() { return { status: 'success' }; }
}
