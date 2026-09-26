// IndexNow key file (https://www.indexnow.org/documentation). The key comes from
// the environment so it stays out of this public repository; without a valid
// key the route does not exist. scripts/indexnow-submit.ts points engines here.
export const dynamic = 'force-dynamic';

const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

export function GET(): Response {
  const key = (process.env['INDEXNOW_KEY'] ?? '').trim();
  if (!KEY_PATTERN.test(key)) {
    return new Response('Not Found', { status: 404 });
  }
  return new Response(key, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
