/**
 * NODE_ENV=production bun scripts/bench-edge-cache-html.ts [iterations=2000] [rounds=3]
 * Synthetic React SSR: the real async draw page needs Next request context,
 * server-only modules and a running data API, so it cannot run standalone here.
 * Both paths use the same fixture; MISS actually builds and renders its tree.
 */
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { withDrawsEdgeCache, type EdgeCache } from '../lib/cloudflare/edge-cache';
import { buildCsp } from '../lib/security/csp';

class MemoryCache implements EdgeCache {
  private entry: { url: string; body: string; headers: Headers } | undefined;

  async match(request: Request): Promise<Response | undefined> {
    return this.entry?.url === request.url
      ? new Response(this.entry.body, { headers: this.entry.headers })
      : undefined;
  }

  async put(request: Request, response: Response): Promise<void> {
    this.entry = { url: request.url, body: await response.text(), headers: new Headers(response.headers) };
  }

  clear(): void { this.entry = undefined; }
}

// Public synthetic fixture, unrelated to live traffic or retained operational data.
const draws = Array.from({ length: 100 }, (_, index) => ({
  contest: 3000 - index,
  date: '2026-01-01',
  numbers: Array.from({ length: 6 }, (_, number) => ((index + number * 7) % 60) + 1),
}));
const scriptPayload = JSON.stringify(draws.slice(0, 8));

function renderHtml(nonce: string): string {
  return '<!doctype html>' + renderToString(h('html', { lang: 'pt-BR' },
    h('head', null,
      h('meta', { charSet: 'utf-8' }),
      h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h('title', null, 'Resultado da Mega-Sena 3000'),
      h('link', { rel: 'stylesheet', href: '/_next/static/css/app.css' }),
    ),
    h('body', null, h('main', { className: 'container mx-auto max-w-5xl space-y-12 px-4 py-8' },
      h('h1', null, 'Resultado da Mega-Sena 3000'),
      h('p', null, 'Os resultados são aleatórios. As estatísticas descrevem o passado.'),
      h('table', null,
        h('caption', null, 'Histórico de concursos'),
        h('tbody', null, draws.map(draw => h('tr', { key: draw.contest },
          h('th', { scope: 'row', className: 'px-4 py-3' },
            h('a', { href: `/concurso/${draw.contest}` }, `Concurso ${draw.contest}`)),
          h('td', { className: 'px-4 py-3' }, draw.date),
          h('td', { className: 'px-4 py-3' }, draw.numbers.map(number =>
            h('a', { key: number, href: `/numeros/${number}`, className: 'text-primary underline' }, String(number).padStart(2, '0')))),
          h('td', { className: 'px-4 py-3' }, 'R$ 1.000.000,00'),
        ))),
      ),
      // Ten nonce attributes plus ten occurrences inside inline RSC-like text.
      Array.from({ length: 10 }, (_, index) => h('script', {
        key: index, nonce,
        dangerouslySetInnerHTML: { __html: `self.__next_f.push([1,${JSON.stringify(nonce)},${scriptPayload}]);` },
      })),
    )),
  ));
}

async function render(): Promise<Response> {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  return new Response(renderHtml(nonce), { headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': buildCsp({ isDev: false, nonce }),
  } });
}

const iterations = Number(process.argv[2] ?? 2000);
const rounds = Number(process.argv[3] ?? 3);
if (!Number.isSafeInteger(iterations) || iterations < 1 || !Number.isSafeInteger(rounds) || rounds < 1) {
  throw new Error('Uso: bun scripts/bench-edge-cache-html.ts [iterações positivas] [rodadas positivas]');
}

const cache = new MemoryCache();
const pending: Promise<unknown>[] = [];
const deps = {
  cache,
  buildVersion: 'benchmark-fixture',
  drawsVersion: async () => 'fixture-revision',
  waitUntil: (promise: Promise<unknown>) => { pending.push(promise); },
};
const request = new Request('https://example.com/concurso/3000');
const sampleNonce = 'MDEyMzQ1Njc4OWFiY2RlZg==';
const sample = renderHtml(sampleNonce);
const bytes = Buffer.byteLength(sample);
const nonceOccurrences = sample.split(sampleNonce).length - 1;
let renderCalls = 0;
const countedRender = () => { renderCalls++; return render(); };

async function run(mode: 'HIT' | 'MISS', count: number): Promise<number> {
  for (let index = 0; index < count; index++) {
    if (mode === 'MISS') cache.clear();
    const response = await withDrawsEdgeCache(request, countedRender, deps);
    const body = await response.text();
    await Promise.all(pending.splice(0));
    if (response.headers.get('X-Megasena-Cache') !== mode || Buffer.byteLength(body) !== bytes) {
      throw new Error(`Resposta inesperada no benchmark ${mode}`);
    }
  }
  return count;
}

await run('MISS', 1);
await run('HIT', 100);
await run('MISS', 100);
const totals = { HIT: 0, MISS: 0 };
console.log(`Bun ${Bun.version}; NODE_ENV=${process.env['NODE_ENV'] ?? '(não definido)'}; renderização SINTÉTICA com React SSR (não é a página real do app).`);
console.log(`HTML: ${bytes} bytes (${(bytes / 1024).toFixed(1)} KiB); ${nonceOccurrences} ocorrências do nonce no corpo.`);
console.log(`${rounds} rodadas × ${iterations} requisições por caminho; aquecimento: 100 por caminho.`);
console.log('Inclui leitura integral da resposta e conclusão de cache.put; cache e drawsVersion em memória, sem rede/DO.');
for (let round = 0; round < rounds; round++) {
  // Alternate order to reduce warmup/order bias. Warm the cache before HIT.
  for (const mode of round % 2 === 0 ? ['HIT', 'MISS'] as const : ['MISS', 'HIT'] as const) {
    const callsBefore = renderCalls;
    const start = process.cpuUsage();
    await run(mode, iterations);
    const cpu = process.cpuUsage(start);
    const cpuPerRequest = (cpu.user + cpu.system) / iterations;
    totals[mode] += cpuPerRequest;
    if (renderCalls - callsBefore !== (mode === 'MISS' ? iterations : 0)) throw new Error('Contagem de renders inesperada');
    console.log(`Rodada ${round + 1} ${mode}: ${cpuPerRequest.toFixed(2)} µs CPU/req (${((cpu.user + cpu.system) / 1000).toFixed(1)} ms CPU total)`);
  }
}
console.log(`Média HIT: ${(totals.HIT / rounds).toFixed(2)} µs CPU/req`);
console.log(`Média MISS: ${(totals.MISS / rounds).toFixed(2)} µs CPU/req`);
console.log(`Razão MISS/HIT: ${(totals.MISS / totals.HIT).toFixed(2)}×`);
console.log('Medição local de CPU do processo; não estima latência ou CPU do Worker em produção.');
