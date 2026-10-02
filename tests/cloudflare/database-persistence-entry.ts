import { MegaSenaData } from '../../cloudflare/data-object';
import seed from '../../db/seed/draws.json';
export { MegaSenaData };
const worker = {
  async fetch(request: Request, env: { DATA: DurableObjectNamespace<MegaSenaData> }) {
    const object = env.DATA.getByName('persistence-fixture');
    const pathname = new URL(request.url).pathname;
    if (pathname === '/initialize') {
      const last = seed.at(-1)!;
      // Synthetic contest exists only in this isolated persistence fixture.
      await object.importDraws([{ ...last, contest: last.contest + 1, date: '2026-10-02' }]);
      return Response.json(await object.status());
    }
    if (pathname === '/status') return Response.json(await object.status());
    return object.handle(new Request('https://example.com/api/health'), { clientIp: '203.0.113.8', internal: false, secure: true });
  },
};
export default worker;
