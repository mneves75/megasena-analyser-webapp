// IndexNow key file (https://www.indexnow.org/documentation). The key comes from
// the environment so it stays out of this public repository; without a valid
// key the route does not exist. scripts/indexnow-submit.ts points engines here.
import { readIndexNowKey } from '@/lib/seo/indexnow';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const key = readIndexNowKey();
  if (key === null) {
    return new Response('Not Found', { status: 404 });
  }
  return new Response(key, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
