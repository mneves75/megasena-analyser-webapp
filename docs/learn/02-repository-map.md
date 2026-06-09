# 02 - Mapa do Repositório

## O que este capítulo ensina

Onde fica o quê: a função de cada pasta, as pastas críticas, os pontos de entrada e o
que roda no startup.

## Por que isso importa

Encontrar o arquivo certo em segundos é metade da produtividade. Este é o seu GPS.

## Modelo mental

Três zonas:

- **Servidor de dados** (`server.ts`, `lib/`, `db/`, `scripts/`) — o cérebro Bun.
- **Web** (`app/`, `components/`, `proxy.ts`, `next.config.js`) — a cara Next.js.
- **Qualidade/entrega** (`tests/`, `.github/`, `Dockerfile`, `docs/`) — como se prova
  e se entrega.

---

## Explicação detalhada

### Estrutura de pastas (raiz)

| Caminho | Função |
| --- | --- |
| `server.ts` | Servidor de API em Bun (`Bun.serve`); entrypoint do processo de dados |
| `proxy.ts` | Middleware Next.js: nonce + CSP + headers de segurança |
| `next.config.js` | `output: standalone`, rewrite `/api/*`, exclusões de tracing |
| `app/` | Rotas do App Router (páginas, route handlers de metadados, ícones OG) |
| `components/` | UI reutilizável (`ui/`, `charts/`, `bet-generator/`, `privacy/`, `seo/`) |
| `lib/` | Lógica de negócio e utilidades |
| `lib/analytics/` | Engines estatísticos + gerador de apostas |
| `lib/api/` | Cliente CAIXA e helper de fetch RSC→API |
| `lib/security/` | CSP, pseudonimização, HTTP, API interna, sanitização, input |
| `lib/seo/` | Fábricas de schema.org |
| `db/` | Banco SQLite (`mega-sena.db`) e `migrations/*.sql` |
| `scripts/` | CLIs em Bun (dev, start, migrate, pull-draws, segurança, deploy) |
| `tests/` | Vitest (unit) espelhando `lib/`/`components/`; `tests/app/` é Playwright |
| `docs/` | Especificações, segurança, privacidade, LGPD e esta trilha (`docs/learn/`) |
| `.github/workflows/` | CI: `ci-cd.yml` e `cli-smoke.yml` |
| `Dockerfile`, `docker-compose.yml` | Imagem runtime-only e orquestração local |
| `public/` | Assets estáticos e `.well-known/` |
| `dist/standalone/` | Saída sincronizada para deploy self-hosted |

### Pastas/arquivos críticos (não quebre sem cuidado)

- **`lib/db.ts`** — única porta para o SQLite; mexer aqui afeta tudo e os testes.
- **`server.ts`** — toda a superfície da API, rate limit, CORS, auditoria.
- **`db/migrations/*.sql`** — alterações de schema; são aplicadas em ordem por nome e
  registradas em `migrations`. Nunca edite uma migração já aplicada em produção; crie
  uma nova.
- **`lib/security/*`** — qualquer mudança pode afetar CSP/LGPD; há testes dedicados em
  `tests/lib/security/`.
- **`lib/constants.ts`** — `BET_PRICES`, `BASE_URL`, `API_CONFIG`; valores de negócio.

### Pontos de entrada (entrypoints)

| Entrypoint | Como inicia | O que faz |
| --- | --- | --- |
| `server.ts` | `bun server.ts` (via supervisores) | API + migrations no boot |
| `app/layout.tsx` | render do Next | shell HTML, fontes, JSON-LD, banner |
| `proxy.ts` | middleware do Next | segurança por requisição |
| `scripts/dev.ts` | `bun run dev` | sobe API + Next em dev |
| `scripts/start-prod.ts` | `bun run start` | sobe stack de produção local |
| `scripts/start-docker.ts` | `CMD` do Dockerfile | entrypoint do container |
| `scripts/migrate.ts` | `bun run db:migrate` | aplica migrações |
| `scripts/pull-draws.ts` | `bun run db:pull` | ingere sorteios da CAIXA |

### O que acontece no startup (API)

1. Valida `IP_HASH_SECRET` (fail-closed em produção).
2. `runMigrations()` aplica/valida o schema.
3. Inicia escritores de auditoria/log e schedulers de retenção.
4. `serve(...)` passa a aceitar requisições.
(Detalhe em `03-runtime-architecture.md`.)

### Convenções de nomenclatura

- Componentes: `PascalCase`; utilitários: `camelCase`; arquivos: `kebab-case`.
- Testes espelham a origem: `tests/lib/analytics/...` testa `lib/analytics/...`.
- Eventos de log/auditoria usam nomes pontilhados (`api.request_completed`,
  `bets.generate_completed`).

### Duas trilhas de aprendizado em `docs/learn/`

- **Esta trilha (sistema):** `01`–`10` — arquitetura, dados, subsistemas, operações.
- **Trilha de matemática (existente):** `chapter-01-introduction.md` …
  `chapter-08-testing.md` — combinatória, estatística, algoritmos da loteria.
As duas se complementam; veja o `README.md` desta pasta.

## Como verificar isso no código

```bash
# Pontos de entrada e scripts
grep -n "\"scripts\"" -n package.json
sed -n '1,40p' next.config.js

# Migrações em ordem
ls db/migrations

# Onde os testes espelham a origem
find tests -type f | sort
```

## Mal-entendidos comuns

- **"`app/api/` é a API."** Em `app/api/*` existem apenas **diretórios vazios** (sem
  nenhum `route.ts`/arquivo — verificado). A API real que toca o banco é o servidor Bun
  (`server.ts`); o `next.config.js` reescreve `/api/*` para ele.
- **"`dist/standalone` é gerado no build."** É sincronizado por `bun run dist:standalone`
  (`sync-standalone-dist.ts`), um passo separado do `bun run build`.
- **"Posso editar uma migração antiga."** Não; crie uma nova migração.

## Exercícios

1. **(Fácil)** Para cada script em `package.json`, diga qual arquivo de `scripts/` ele
   executa. **Gabarito:** ver a seção "scripts" do `package.json`.
2. **(Médio)** Você precisa mudar o preço de uma aposta de 7 números. Qual arquivo?
   **Gabarito:** `lib/constants.ts` (`BET_PRICES[7]`).
3. **(Médio)** Onde adicionar um teste unitário para um novo helper em `lib/security/`?
   **Gabarito:** `tests/lib/security/<nome>.test.ts`.

---

### Procedência das afirmações

- **Verificado no código:** árvore de pastas e entrypoints (listagem do repo,
  `package.json`, `next.config.js`, `Dockerfile`); ordem de migrações.
- **Verificado no código:** `app/api/*` contém apenas diretórios vazios (sem arquivos);
  a API que consulta o banco está em `server.ts`, alcançada pelo rewrite do `next.config.js`.
- **Conhecimento externo:** convenções de App Router.
