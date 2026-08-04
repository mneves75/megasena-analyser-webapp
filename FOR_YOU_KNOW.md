# Mega-Sena Analyzer — o mapa mental

Pense no projeto como duas aplicações que compartilham o mesmo endereço. O Next.js renderiza as páginas e o Bun serve toda a API em `server.ts`. O `next.config.js` encaminha `/api/*` para o Bun; por isso uma rota de API nova nunca deve nascer em `app/api/`.

## Como os dados atravessam o sistema

1. `scripts/pull-draws.ts` consulta a API oficial da CAIXA pelo cliente validado em `lib/api/caixa-client.ts`.
2. `lib/db.ts` grava os concursos no SQLite dentro de uma transação e aplica as migrations de `db/migrations/`.
3. Os engines em `lib/analytics/` leem o histórico e produzem frequências, padrões, sequências e planos de apostas.
4. `server.ts` valida cada entrada com Zod, aplica rate limit e entrega JSON para as páginas em `app/`.

O SQLite é o livro-caixa; as tabelas derivadas e os caches são índices de consulta. Se uma ingestão muda `draws`, a migration 010 incrementa uma revisão monotônica por trigger. Dashboard, estatísticas e tendências usam essa revisão para nunca servir uma resposta anterior à correção dos dados.

## Por que Bun e pnpm coexistem

Bun é o runtime: a aplicação depende de `bun:sqlite` e não roda sob Node.js. pnpm é apenas o gerenciador de dependências e aplica as políticas de supply chain de `pnpm-workspace.yaml`, incluindo idade mínima de release e bloqueio de downgrade de confiança. Em resumo: `pnpm install`; `bun run ...`.

## Fronteiras que não devem ser atravessadas

- O frontend não acessa SQLite diretamente; passa pela API Bun.
- A API pública não confia em headers de proxy sem peer explicitamente confiável.
- Produção não inicia sem `IP_HASH_SECRET` válido, evitando registrar pseudônimos fracos por engano.
- No container, código e dependências são root-owned. O usuário `bun` escreve apenas no banco, nos logs e em `.next/cache`.
- A imagem contém a cópia canônica das migrations em `/app/migrations-source`; um volume persistente pode ter arquivos antigos.

## Onde bugs costumam se esconder

- Datas da CAIXA chegam em formato brasileiro; normalize antes de persistir ou agrupar no SQLite.
- Atualizar `draws` exige reconstruir derivados dentro da mesma transação, ou leituras podem misturar dados novos com índices antigos.
- O banco de teste padrão é em memória e não cobre todos os detalhes do SQLite real. Use `VITEST_FORCE_FILE_DB=1` para migrations e SQL sensível.
- Redes de datacenter podem ser bloqueadas pela CAIXA; atualização de dados e deploy de código são responsabilidades separadas.
- A Cloudflare pode alterar métricas e headers. Meça primeiro o build local de produção e use `security:csp:edge` depois de mudanças na borda.

## Caminho curto para validar uma mudança

Comece pelo teste do módulo tocado. Depois rode `bun run lint`, `bun run lint:ast`, `bun run typecheck`, `bun run test -- --run`, `pnpm audit --prod` e `bun run build`. Mudança visual também exige `bun run test:e2e` e inspeção real em desktop e mobile.
