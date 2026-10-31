# Contratos de cache

Estado em 2026-10-31 (1.19.2). Fonte: `lib/cloudflare/edge-cache.ts`,
`cloudflare/worker.ts`; testes em `tests/lib/cloudflare-edge-cache.test.ts`.
Nenhuma camada de cache compartilhado da zona armazena respostas do Worker: o HTML sai
com `Cache-Control: private, no-cache, no-store`. A única camada de armazenamento é a
**Cache API do colo** (`caches.default`), local a cada data center, sem replicação nem
tiering ([doc](https://developers.cloudflare.com/workers/runtime-apis/cache/), lida
em 2026-10-31). O app não tem autenticação nem cookies próprios. O isolamento por
usuário se resume a **não armazenar nada que dependa da requisição**.

## Classe A — arquivos determinísticos

| Campo | Valor |
|---|---|
| Rotas | `/opengraph-image`, `/twitter-image`, `/concurso/:n/opengraph-image`, `/concurso/:n/twitter-image`, `/sitemap.xml`, `/llms.txt` |
| Público/privado | Público; a origem deve declarar `public` sem `private`/`no-store` |
| Chave | `origin + path + ?build=<APP_VERSION>&draws=<revisão>`; a query do cliente é ignorada |
| Variantes | Nenhuma; `Vary` além de `Accept-Encoding` e headers de framework → não armazena |
| TTL | 86.400 s na cópia interna; o `Cache-Control` original é devolvido ao cliente |
| Staleness aceitável | Zero: a revisão de draws entra na chave e é lida do DO a cada requisição |
| Invalidação | Implícita: nova revisão ou nova versão de build mudam a chave |
| Misses concorrentes | Cada miss renderiza e grava (sem coalescência); o último `put` vence, com conteúdo idêntico |
| Falha da origem | Não-200 não é armazenado; falha de lookup/revisão renderiza sem cache |
| Bypass | Método ≠ GET, `Authorization`, `Cookie`, `Range`, `If-*`, headers de framework/RSC, `_rsc` |

## Classe B — HTML de arquivo

| Campo | Valor |
|---|---|
| Rotas | `/concurso/:n` (n ≤ 999.999), `/numeros/:n` (n ≤ 60), `/resultados/:ano` (1996–2100), só **sem query** |
| Público/privado | Cópia interna apenas; o cliente sempre recebe `Cache-Control: no-store` |
| Chave | `origin + path + ?build=<APP_VERSION>&draws=<revisão>` |
| Variantes | Nenhuma; requisições com `Cookie`/`Authorization`/framework/query nunca leem nem gravam |
| TTL | 86.400 s na cópia interna |
| Staleness aceitável | Zero (revisão lida do DO por requisição) |
| Invalidação | Implícita pela chave |
| Nonce CSP | Todo HIT troca o nonce armazenado por um novo, nos headers e em todo o HTML/RSC; um nonce armazenado nunca é reenviado |
| Não armazena | Não-200, `Set-Cookie`, sem nonce, `Content-Encoding`, `no-transform`, `Vary` não reconhecido |
| Falha da origem | Igual à classe A |

## Proposta W2 — revisão de draws local ao colo (não implementada)

| Campo | Valor proposto |
|---|---|
| Objeto | Registro interno com a revisão de draws na Cache API do colo |
| Chave | `origin + /__megasena/draws-revision?build=<APP_VERSION>` (nunca roteável publicamente: lido só via `cache.match` com `Request` sintético) |
| TTL | 60 s (`Cache-Control: public, max-age=60` só na cópia interna) |
| Staleness aceitável | ≤ 60 s **por colo** após um novo sorteio ou correção. Os sorteios são publicados uma vez por dia e a ingestão roda às 06:00 UTC |
| Invalidação | Expiração por TTL; a nova versão de build muda a chave |
| Misses concorrentes | Cada miss faz um RPC e grava; aceitável (o valor é idêntico) |
| Falha | Erro no registro → RPC direto como hoje; erro no RPC → render sem cache, como hoje |
| Isolamento | Valor global e público (um inteiro); não depende de requisição nem de usuário |

Testes de isolamento exigidos antes de qualquer classe nova: mesma URL com e sem
`Cookie`, duas origens/hosts, `Set-Cookie` nunca armazenado, query não vaza para a
chave de HTML, nonce nunca reenviado, escrita (nova revisão) seguida de leitura dentro
da janela declarada.
