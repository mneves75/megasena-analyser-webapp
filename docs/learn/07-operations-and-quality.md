# 07 - Operações e Qualidade

## O que este capítulo ensina

Como configurar o ambiente, testar, observar, construir, implantar e manter o sistema
confiável e seguro.

## Por que isso importa

Código que não builda, não testa ou não implanta não entrega valor. Aqui está o
"como rodar de verdade", com base nos scripts e na CI reais.

## Modelo mental

Um funil de qualidade: **lint/typecheck → testes unitários → E2E → build → imagem →
varredura de segurança → deploy → verificação pós-deploy**. Cada estágio é um portão.

---

## Explicação detalhada

### Ambiente e configuração

- Runtime: **Bun ≥ 1.3.14** (obrigatório; `bun:sqlite`).
- Copie `.env.example` → `.env.local`. Variáveis principais (lista completa em
  `06`/`09`): `API_PORT` (3201), `PORT` (3000), `IP_HASH_SECRET` (≥32, obrigatório em
  produção), `ALLOWED_ORIGINS`, `INTERNAL_API_SECRET`, `TRUST_PROXY_HEADERS`,
  `TRUSTED_PROXY_IPS`, `DATABASE_PATH`, `AUDIT_RETENTION_DAYS` (400),
  `LOG_RETENTION_DAYS` (30).
- Setup local:
  ```bash
  bun install
  bun run db:migrate
  bun run db:pull -- --limit 100   # opcional: amostra
  bun run dev                      # http://localhost:3000
  ```

### Testes

- **Unit (Vitest):** `bun run test` (watch) / `bun run test -- --run` (CI). Config em
  `vitest.config.ts` (jsdom, setup `tests/setup.ts`, cobertura v8 com threshold 80%).
- **Banco em memória:** em Vitest, `lib/db.ts` usa `InMemoryDatabase` (sem I/O). Force
  banco real com `VITEST_FORCE_FILE_DB=1`.
- **E2E (Playwright):** `bun run test:e2e`. `playwright.config.ts` sobe a stack real via
  `prepare-e2e-db.ts && build && start`, injetando `IP_HASH_SECRET_AUTOGENERATE=true` e
  `TRUST_PROXY_HEADERS=true` (apenas teste). Specs em `tests/app/*.spec.ts`.
- Rode um arquivo só: `bun x vitest tests/lib/bet-generator.test.ts --run`.

### Logs e observabilidade

- Logs estruturados via `logger` (console + sink SQLite `log_events`). Eventos têm
  nomes pontilhados; `debug` só com `DEBUG=true`.
- Auditoria de negócio em `audit_logs` (eventos `api.*`, `bets.generate_requested`).
- Toda requisição da API gera `api.request_received` e `api.request_completed` com
  `requestId`, `route`, `statusCode`, `durationMs`.
- Retenção automática (hard delete) por schedulers de 24h; também manual:
  `bun run audit:prune` / `bun run log:prune` (aceitam `--days`, `--before`, `--dry-run`).
- Health: `GET /api/health` retorna `status`, `version`, `database.totalDraws`,
  `lastContestNumber`, `lastDrawDate` (200 se pronto, 503 se sem dados).

### Build e deploy

```bash
bun run build            # next build + assert-standalone-clean
bun run dist:standalone  # sincroniza dist/standalone (passo separado)
bun run start            # stack de produção local
```

- `assert-standalone-clean.ts` **falha o build** se `.next/standalone/db/` contiver
  `*.db`, `*-wal`, `*-shm`, `*.bak` (não publicar estado local de banco).
- `sync-standalone-dist.ts` copia `.next/standalone` → `dist/standalone`, traz
  `.next/static`, remove `db/` e checa que `server.js` não tem rewrite para porta de
  API errada.
- **Docker:** imagem runtime-only (`oven/bun:1.3.14-alpine`), copia `dist/standalone`
  pré-construído, monta `./db:/app/db` por volume, healthcheck em `/api/health`,
  `CMD ["bun","scripts/start-docker.ts"]`.
- **Deploy é manual** (Coolify não auto-deploy do GitHub). Reverse proxy Traefik +
  Cloudflare. HSTS no proxy, não no app.

### Verificações pós-deploy (portões finais)

- `bun run deploy:verify` (`check-production-freshness.ts`): confere `/api/health`
  saudável, `version` igual ao `package.json`, `totalDraws ≥ 3000` e último sorteio com
  no máx. 21 dias. Versão divergente = release não implantada.
- `bun run security:csp:edge` (`check-edge-csp.ts`): confirma que a borda pública não
  substituiu a CSP nonce-based do app; classifica o provável dono de uma sobrescrita e
  imprime fingerprint/remediação sem vazar segredos.

### CI (`.github/workflows`)

- `ci-cd.yml`: `secrets` (Gitleaks) → `lint` (`bun audit`, ESLint zero-warning,
  `tsc --noEmit`) + `test` → `e2e` (Playwright) → `build` (+`dist`, push GHCR) → `sbom`
  (CycloneDX) → `security` (Trivy CRITICAL/HIGH, só em push). Bun fixado em 1.3.14.
- `cli-smoke.yml`: roda `db:migrate` e os prunes em `--dry-run` para garantir que as
  CLIs não quebraram.

### Segurança (resumo operacional)

- Validação Zod em toda entrada; SQL parametrizado; rate limit 100/min por IP
  pseudonimizado; CORS estrito; CSP por nonce; sanitização de metadados; segredos fora
  do repo; `overrides` no `package.json` são pins de segurança temporários.
- Histórico de segredos: `bun run security:secrets:history` (falha se houver achados
  alcançáveis por branch/tag).

### Confiabilidade

- Boot ordenado (API antes do Next), `SIGTERM`→`SIGKILL` com período de graça, flush
  final das filas de log/auditoria no shutdown, `bunfig.toml` `run.noOrphans=true`.

## Como verificar isso no código

```bash
grep -n "\"scripts\"" -n package.json
sed -n '1,40p' vitest.config.ts
sed -n '1,40p' playwright.config.ts
grep -n "collectForbiddenFiles" scripts/assert-standalone-clean.ts
grep -n "validateHealthPayload\|EXPECTED_VERSION" scripts/check-production-freshness.ts
```

## Mal-entendidos comuns

- **"`bun run build` já gera o `dist`."** Não; `dist:standalone` é separado.
- **"Push no GitHub implanta."** Não; deploy é manual.
- **"Cobertura 80% é sugestão."** É threshold de Vitest; abaixo disso falha.
- **"E2E usa o banco de produção."** Não; usa um banco isolado em `.tmp/e2e`.

## Exercícios

1. **(Fácil)** Qual comando prova que a produção está na versão certa? **Gabarito:**
   `bun run deploy:verify`.
2. **(Médio)** Por que `assert-standalone-clean.ts` existe? **Gabarito:** impedir que
   arquivos `.db`/WAL/backup locais vão para a imagem Docker.
3. **(Médio / debug)** A CI falha no job `lint` com warning de tipo não usado. Como
   reproduzir local? **Gabarito:** `bun run lint` (zero-warning) e `bun x tsc --noEmit`.
4. **(Difícil)** Escreva o passo-a-passo de um deploy manual seguro, citando os dois
   portões pós-deploy. **Gabarito:** build → dist → enviar artefatos → rebuild container
   → `deploy:verify` → `security:csp:edge`.

---

### Procedência das afirmações

- **Verificado no código:** scripts (`package.json`, `scripts/*`), configs
  (`vitest.config.ts`, `playwright.config.ts`), CI (`.github/workflows/*`), Docker,
  verificadores pós-deploy.
- **Inferido do código:** o "funil de qualidade" como modelo (deduzido do grafo de jobs
  da CI).
- **Conhecimento externo:** Coolify/Traefik/Cloudflare como descrito em `CLAUDE.md`/
  `docs/DEPLOY.md` (infra fora do repo; não verificável no código).
