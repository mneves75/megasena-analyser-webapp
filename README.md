# Mega-Sena Analyzer

Aplicação Next.js (App Router) para sincronizar concursos oficiais da Mega-Sena, gerar estatísticas avançadas e sugerir apostas otimizadas respeitando orçamento e regras CAIXA. Toda a experiência, documentação e UI estão em português brasileiro.

## Scripts principais

- `npm run dev`: inicia o servidor de desenvolvimento com Turbopack.
- `npm run build`: gera o bundle de produção.
- `npm run start`: serve o build produzido localmente.
- `npm run lint`: executa o ESLint com regras estritas (max warnings = 0).
- `npm run typecheck`: valida tipos sem emitir artefatos.
- `npm run format`: formata o projeto com Prettier.
- `npm run prepare`: instala ganchos Husky (`pre-commit` roda `lint-staged`).
- `npm run db:migrate`: aplica migrations Prisma localmente.
- `npm run db:deploy`: aplica migrations em produção.
- `npm run db:generate`: gera o client Prisma.
- `npm run db:seed`: popula metadados e tabela de preços oficiais.
- `npm run db:reset`: recria o banco SQLite do zero (atenção: apaga dados locais).
- `npm run sync`: executa sincronização da Mega-Sena via CLI (`--full` para backfill limitado, `--limit=N` para ajustar janela).
- `npm test`: roda a suíte de testes unitários (Vitest).

## Banco de dados

- O projeto usa SQLite via Prisma (arquivo padrão `./dev.db`).
- Configure variáveis em `.env` (`DATABASE_URL="file:./dev.db"`).
- Após clonar o repositório, execute `npm run db:migrate` seguido de `npm run db:seed`.
- Seeds criam registros em `meta` (`schema_version`, `last_sync`, `price_last_checked`) e na tabela `Price` com custos combinatórios atualizados.
- Camada de acesso ao banco fica em `src/data/**`, com módulos marcados com `server-only`.
- Rota protegida `POST /api/sync` e o script `npm run sync` utilizam o mesmo serviço (`src/services/sync.ts`). Defina `SYNC_TOKEN` no `.env` para autenticação quando exposto publicamente.

## Preços oficiais

- Valor mínimo (k = 6) atualizado para **R$ 6,00** em 12 de julho de 2025 (fonte CAIXA). Custos para demais valores de `k` são obtidos via `C(k, 6) * preço base` e já estão semeados na tabela `Price`.
- Os helpers de preços residem em `src/services/pricing.ts` e expõem `getPriceForK`, `calculateTicketCost` e `calculateBudgetAllocation` para uso em Server Components/Actions.
- Execute `npm run test -- pricing` para validar cálculos oficiais, fallback `.env` e limites de orçamento antes de publicar alterações no motor de apostas.

## Motor de apostas (Stage 3)

- Estratégias iniciais (`uniform`, `balanced`) estão em `src/services/strategies/**` e compartilham PRNG determinístico (`src/lib/random.ts`).
- O workflow `generateBatch` vive em `src/services/bets.ts`, consolida orçamento via `calculateBudgetAllocation`, aplica pesos de estratégia e registra métricas agregadas.
- Payloads serializados seguem o contrato `docs/data-contracts/strategy_payload.schema.json` (versão `1.0`).
- Testes unitários dedicados em `src/services/__tests__/bets.test.ts` (`npm run test -- bets`).
- Fixture de referência disponível em `docs/fixtures/sample-bets.json` (seed `FIXTURE-SEED`). Gere novas amostras com `NODE_OPTIONS="-r ./scripts/dev/register-server-only-stub.js" npx tsx scripts/dev/generate-batch.ts`.
- Persistência e APIs: `persistBatch`/`listBets` em `src/services/bet-store.ts`, rotas `/api/bets/generate` (POST protegido por `SYNC_TOKEN`) e `/api/bets` (GET com filtros básicos) para integração externa.

## Variáveis de ambiente relevantes

- `DATABASE_URL`: caminho do SQLite (ex.: `file:./dev.db`).
- `SYNC_TOKEN`: token Bearer utilizado pela rota `/api/sync`.
- `CAIXA_API_URL` (opcional): sobrescreve endpoint oficial da Mega-Sena.
- `CAIXA_MAX_RETRIES` e `CAIXA_RETRY_DELAY_MS` (opcionais): configuram política de retry do cliente CAIXA.
- `LOG_LEVEL`: nível de log aceito pelo Pino (`info`, `debug`, etc.).
- `SYNC_BACKFILL_WINDOW`: limite padrão de concursos buscados quando o banco está vazio (default 50).
- `MEGASENA_BASE_PRICE_CENTS` (opcional): sobrescreve o valor-base utilizado para calcular apostas quando não houver registro na tabela `Price` (default `600`).
- `MEGASENA_PRICE_FALLBACK_UPDATED_AT` (opcional): ISO date/time utilizada ao informar o fallback de preço via ambiente.

Exemplo de `.env` local:

```env
# Variáveis locais — mantenha uma variável por linha
DATABASE_URL="file:./dev.db"
SYNC_TOKEN=local-sync-token
```

> **Importante:** cada variável deve ficar em uma linha separada. Ausência de quebra de linha pode invalidar `DATABASE_URL` e impedir que o Prisma inicialize.

## Estrutura de pastas

```
src/
  app/            # Rotas App Router (início, stats, generate, bets, docs)
  components/     # Componentes reutilizáveis (layout, ui)
  lib/            # Utilidades compartilhadas
public/            # Assets estáticos
docs/             # Planejamento, prompts e tokens de design
```

## Convenções de código

- TypeScript obrigatório; priorize React Server Components e use `"use client"` apenas quando necessário.
- Estilo e formatação controlados por ESLint + Prettier; configure format-on-save.
- Tokens visuais documentados em `docs/design/tokens.md`. Utilize `buttonStyles` e componentes `Card` para manter consistência.
- Classes Tailwind em `kebab-case`; prefira utilitários a CSS global, estendendo o config quando precisar de novos tokens.

## Documentação viva

- Plano iterativo completo: `docs/IMPLEMENTATION_PLAN.md`.
- Prompt operacional e restrições: `docs/PROMPT MEGASENA APP.md`.
- Tokens e referências de UI: `docs/design/tokens.md`.
- Plano de remediação do sync: `docs/SYNC_REMEDIATION_PLAN.md`.
- Estratégia balanceada documentada: `docs/strategies/balanced.md`.
- Plano Stage 3 do motor: `docs/PHASE5_STAGE3_PLAN.md`.
- API do motor: `docs/API_BET_ENGINE.md`.
- Roadmap pós-MVP (Stage 6): `docs/PHASE5_STAGE6_ROADMAP.md`.

## API de Estatísticas

- `GET /api/stats/frequencies?window=50`
- `GET /api/stats/pairs?window=100&limit=20`
- `GET /api/stats/triplets?limit=10`
- `GET /api/stats/runs`
- `GET /api/stats/sums?window=200`
- `GET /api/stats/quadrants?window=30`
- `GET /api/stats/recency`

Todos os endpoints retornam JSON; parâmetros `window` e `limit` são opcionais e validados. Após sincronizações, o cache interno é limpo automaticamente.

## Contribuição

1. Execute `npm run lint` e `npm run build` antes de abrir PR.
2. Documente no PR as seções cobertas, testes executados e evidências (prints, logs).
3. Atualize `docs/` quando alterar regras, fontes oficiais ou tokens.
4. Respeite o plano de fases e registre riscos/decisões importantes no guia correspondente.

> **Aviso**: Loterias envolvem risco financeiro. Nenhum módulo prevê resultados; o foco é análise estatística e uso responsável do orçamento.
