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
- `npm run sync`: executa sincronização da Mega-Sena via CLI (`--full` reprocessa todo o histórico; combine com `--limit=N` para restringir a quantidade de concursos quando necessário).
- `npm run limits`: inspeciona e altera limites operacionais do motor (`--show`, `--set=maxTicketsPerBatch=120`, `--reset`, `--history`).
- `npm run cli`: executa o utilitário `megasena` com subcomandos (`summary`, `stats`, `sync`).
- `npm test`: roda a suíte de testes unitários (Vitest).

### CLI `megasena`

O utilitário de linha de comando centraliza as principais operações headless:

- `npm run cli summary -- --window 200 --json` &rarr; imprime os mesmos destaques da Home em JSON.
- `npm run cli stats frequencies -- --window 100 --limit 5` &rarr; lista combinações mais frequentes.
- `npm run cli sync -- --limit 20 --verbose` &rarr; executa sincronização incremental; o modo silencioso ativa automaticamente quando `CI` está definido.
- `npm run cli bets generate -- --budget 150 --strategy hot-streak --seed SEED-DEMO` &rarr; gera lote auditável (persiste somente com `--persist`).
- `npm run cli bets list -- --strategy balanced --limit 5 --json` &rarr; exporta histórico recente para integrações.
- `npm run cli limits -- --set maxTicketsPerBatch=150 --json` &rarr; aplica override documentado nos registros de auditoria.

> Consulte `docs/CLI_TRANSCRIPTS.md` para transcrições completas de sessões (após `db:seed` + sync).

Todos os comandos aceitam `--json`/`--pretty-json` para automação. Consulte `docs/CLI_PARITY_PLAN.md` para roadmap e próximos subcomandos (`bets generate`, `bets list`).

## Banco de dados

- O projeto usa SQLite via Prisma (arquivo padrão `./dev.db`).
- Configure variáveis em `.env` (`DATABASE_URL="file:./dev.db"`).
- Após clonar o repositório, execute `npm run db:migrate` seguido de `npm run db:seed`.
- Seeds criam registros em `meta` (`schema_version`, `last_sync`, `price_last_checked`) e na tabela `Price` com custos combinatórios atualizados.
- Alterações de limites operacionais são registradas na tabela `BettingLimitAudit`, permitindo trilha de auditoria (script `npm run limits`).
- Camada de acesso ao banco fica em `src/data/**`, com módulos marcados com `server-only`.
- Rota protegida `POST /api/sync` e o script `npm run sync` utilizam o mesmo serviço (`src/services/sync.ts`). Defina `SYNC_TOKEN` no `.env` para autenticação quando exposto publicamente.

## Preços oficiais

- Valor mínimo (k = 6) atualizado para **R$ 6,00** em 12 de julho de 2025 (fonte CAIXA). Custos para demais valores de `k` são obtidos via `C(k, 6) * preço base` e já estão semeados na tabela `Price`.
- Os helpers de preços residem em `src/services/pricing.ts` e expõem `getPriceForK`, `calculateTicketCost` e `calculateBudgetAllocation` para uso em Server Components/Actions.
- Execute `npm run test -- pricing` para validar cálculos oficiais, fallback `.env` e limites de orçamento antes de publicar alterações no motor de apostas.

## Motor de apostas (Stage 3)

- Estratégias disponíveis (`uniform`, `balanced`, `hot-streak`, `cold-surge`) estão em `src/services/strategies/**` e compartilham PRNG determinístico (`src/lib/random.ts`). Consulte `docs/strategies/*.md` para detalhes de cada abordagem.
- O workflow `generateBatch` vive em `src/services/bets.ts`, consolida orçamento via `calculateBudgetAllocation`, aplica pesos de estratégia e registra métricas agregadas.
- Payloads serializados seguem o contrato `docs/data-contracts/strategy_payload.schema.json` (versão `1.0`) e incluem `ticketCostBreakdown`/`averageTicketCostCents` quando o orçamento é distribuído.
- Overrides de dezenas (`kOverride`) honram o custo real de cada ticket; o orçamento precisa cobrir o valor integral do maior `k` solicitado. Quando o saldo restante não comporta o override, o motor registra aviso e utiliza o `k` padrão disponível.
- Testes unitários dedicados em `src/services/__tests__/bets.test.ts` (`npm run test -- bets`).
- Fixture de referência disponível em `docs/fixtures/sample-bets.json` (seed `FIXTURE-SEED`). Gere novas amostras com `NODE_OPTIONS="-r ./scripts/dev/register-server-only-stub.js" npx tsx scripts/dev/generate-batch.ts`.
- Persistência e APIs: `persistBatch`/`listBets` em `src/services/bet-store.ts`, rotas `/api/bets/generate` (POST protegido por `SYNC_TOKEN`) e `/api/bets` (GET com filtros básicos) para integração externa.

## CLI operacional

- `npm run cli -- <comando>` aciona o binário `megasena` com os mesmos serviços utilizados pela UI (requer `DATABASE_URL`).
- Comandos atuais:
  - `megasena summary [--window N] [--json|--pretty-json]` – espelha os cards da home.
  - `megasena stats <frequencies|pairs|triplets|runs|sums|quadrants|recency>` com flags `--window`, `--limit`, `--json`.
  - `megasena sync [--full] [--limit N] [--silent] [--json]` – sincroniza concursos; `--json` ou `--silent` forçam modo headless.
  - `megasena bets generate --budget 120.50 [--strategy balanced] [--k 7] [--spread-budget] [--persist] [--json]` – gera lotes idênticos à UI; só grava quando `--persist` for usado.
  - `megasena bets list [--strategy uniform] [--from 2025-09-01] [--limit 10] [--json]` – consulta apostas armazenadas com filtros opcionais.
- Em CI defina `--silent` (ou use `--json`) para evitar barras de progresso; logs seguem `LOG_LEVEL`.
- Saídas JSON são determinísticas e pensadas para piping (`jq`, `xargs`); consulte `docs/operations.md` para exemplos completos.

## Variáveis de ambiente relevantes

- `DATABASE_URL`: caminho do SQLite (ex.: `file:./dev.db`).
- `SYNC_TOKEN`: token Bearer utilizado pela rota `/api/sync`.
- `CAIXA_API_URL` (opcional): sobrescreve endpoint oficial da Mega-Sena.
- `CAIXA_MAX_RETRIES` e `CAIXA_RETRY_DELAY_MS` (opcionais): configuram política de retry do cliente CAIXA.
- `LOG_LEVEL`: nível de log aceito pelo Pino (`info`, `debug`, etc.).
- `LOG_PRETTY`: defina `LOG_PRETTY=1` quando rodar scripts CLI fora do Next para habilitar saída formatada via `pino-pretty` (não habilite durante `next dev`).
- `SYNC_BACKFILL_WINDOW`: limite padrão de concursos buscados quando o banco está vazio (default 50).
- `MEGASENA_BASE_PRICE_CENTS` (opcional): sobrescreve o valor-base utilizado para calcular apostas quando não houver registro na tabela `Price` (default `600`).
- `MEGASENA_PRICE_FALLBACK_UPDATED_AT` (opcional): ISO date/time utilizada ao informar o fallback de preço via ambiente.

Exemplo de `.env` local:

```env
# Variáveis locais – mantenha uma variável por linha
DATABASE_URL="file:./dev.db"
SYNC_TOKEN=local-sync-token
```

> **Importante:** cada variável deve ficar em uma linha separada. Ausência de quebra de linha pode invalidar `DATABASE_URL` e impedir que o Prisma inicialize. Para logs formatados fora do Next, exporte `LOG_PRETTY=1` apenas no momento de executar scripts CLI.

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

## Visão geral da UI

- **Home** (`src/app/page.tsx`): cards dinâmicos mostram concursos processados, última sincronização, preço base oficial e soma média da janela configurada. O painel lateral lista os seis números mais quentes considerando a janela de 200 concursos.
- **Dashboard de estatísticas** (`src/app/stats/page.tsx` + `src/components/dashboard/stats-dashboard.tsx`): Server Components carregam frequências, pares, quadrantes e soma média diretamente via serviços `@/services/stats`, com gráficos `Chart` e listagens de números quentes/frios.
- **Gerador de apostas** (`src/app/generate/page.tsx` + `src/components/forms/bet-generator-form.tsx`): formulário client-side usa `useActionState` para acionar `generateBetsAction`, aplica validações de orçamento/seed, oferece as quatro estratégias disponíveis e um toggle "Distribuir orçamento" para gerar lotes com múltiplos valores de `k`, exibindo resumo financeiro e export de payload JSON.
- **Histórico de apostas** (`src/app/bets/page.tsx`): lista os lotes persistidos por `listBets`, exibindo estratégia, seed, orçamento e dezenas por ticket. Quando vazio, orienta gerar um lote.
- **Landing page de conversão**: arquivo independente em `public/conhecendotudo-landing.html` com copy Hormozi-style e componentes inline (HTML/CSS/JS) para campanhas externas.

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

## Próximos passos visuais

- [ ] Atualizar o README com capturas (light/dark) assim que o restante do backlog visual for encerrado.

## Troubleshooting

- **Erro ENOENT `_buildManifest.js.tmp` ao rodar `npm run dev`**: finalize instâncias antigas (`lsof -Pi :3000` + `kill <pid>`), delete `.next` e reinicie. Se persistir, rode `npx next dev` (Webpack) ou exporte `NEXT_DISABLE_TURBOPACK=1` temporariamente. Registre observações em `docs/DEV_SERVER_RECOVERY_PLAN.md`.
- **Gerador de apostas não responde**: confirme se o dev server roda sem Turbopack (ver item acima). Em seguida, verifique se o banco foi sincronizado (`npm run db:seed` + `npm run sync`) e se a Action exibe feedback. Procedimento completo descrito em `docs/GENERATE_PAGE_DIAGNOSIS_PLAN.md`.
- **Aviso Prisma (`package.json#prisma` deprecado)**: planejamento em andamento para migrar configuração para `prisma.config.ts`; siga o roadmap em `docs/DEV_SERVER_RECOVERY_PLAN.md`.
