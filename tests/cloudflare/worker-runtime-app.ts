import robots from '../../app/robots';

const app = {
  fetch(request: Request): Response {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/robots.txt') {
      const policy = robots();
      const body = policy.rules.map(rule => `User-agent: ${rule.userAgent}\nAllow: ${rule.allow}\n${rule.disallow.map(value => `Disallow: ${value}`).join('\n')}`).join('\n') + `\nSitemap: ${policy.sitemap}\n`;
      return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return new Response('<!doctype html><title>Worker boundary fixture</title>', {
      status: pathname === '/missing' ? 404 : 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'" },
    });
  },
};
export default app;
