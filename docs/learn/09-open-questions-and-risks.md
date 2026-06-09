# 09 - Perguntas em Aberto, Suposições e Riscos

## O que este capítulo ensina

Tudo que **não** é certo: ambiguidades, suposições não verificadas, dívida
arquitetural, armadilhas para juniores e investigações recomendadas.

## Por que isso importa

Documentação honesta separa fato de palpite. Confundir os dois gera bugs e decisões
ruins. Aqui está a lista do que verificar antes de confiar.

---

## Suposições não verificadas / discrepâncias doc × código

| # | Afirmação em docs/config | Realidade no código | Ação sugerida |
| --- | --- | --- | --- |
| 1 | `CLAUDE.md`: "Framer Motion para micro-interações" | Nenhum import de `framer-motion` em `app/`/`components/`/`lib/` | Remover a dependência ou usá-la; atualizar doc |
| 2 | `package.json` lista `date-fns` | Nenhum import; datas via `Intl` em `lib/utils.ts` | Remover `date-fns` |
| 3 | `.cursor/rules`: "Supabase keys", "Caixa tokens" | Não há Supabase nem token CAIXA no código | Atualizar/remover regra obsoleta |
| 4 | `migrations 004/005`: comentário "soft delete via deleted_at" | `006` removeu `deleted_at`; retenção é hard delete | Corrigir comentários das migrações |
| 5 | `.env.example`: `AUDIT_RETENTION_DAYS=400` | `prune-audit-logs.ts` usa default 365 e não lê a env | Alinhar default do CLI à env |
| 6 | Suposição de que `app/api/*` contém handlers | `app/api/*` são **diretórios vazios** (sem arquivos — verificado); a API real é `server.ts` via rewrite | Remover os diretórios vazios ou documentar que são placeholders |

> Estas seis são **falsificáveis** e foram verificadas por leitura/grep direto.

## Dívida arquitetural (verificada)

- **`ComplexityScoreEngine` definida mas sem uso.** `lib/analytics/complexity-score.ts`
  expõe `calculateComplexityScore`, mas nenhum arquivo de `lib/`, `server.ts`, `app/` ou
  `components/` a chama (verificado por grep). É código morto — ou ligue-a (ex.: nova
  flag em `/api/statistics`, ou no scoring do gerador), ou remova-a.
- **`app/api/*` são diretórios vazios.** Não há `route.ts` algum sob `app/api/*`; a API
  real é `server.ts`. Remova os diretórios para não sugerir uma API que não existe.
- **Tabela `user_bets` morta.** Existe desde a migração `001`, mas nenhum código a lê
  ou escreve. Ou implemente o rastreamento de apostas, ou remova a tabela para não
  confundir o MER.
- **Engines "chatty".** `DecadeAnalysisEngine`, `PrimeAnalysisEngine` e
  `TimeSeriesEngine` emitem muitas consultas pequenas por chamada. Funciona no volume
  atual; vira gargalo se a base crescer ou se a página de estatísticas ficar muito
  acessada. Considere agregações únicas ou caches.
- **`InMemoryDatabase` acoplada a SQL específico.** `lib/db.ts` reconhece apenas os SQLs
  que o app usa hoje (por prefixo normalizado). Um SQL novo num teste pode retornar
  vazio silenciosamente. Risco: testes "passam" sem exercitar o caminho real. Mitigação:
  `VITEST_FORCE_FILE_DB=1` quando o SQL for novo/complexo.
- **Assimetria de `.unref()`.** `log-store.ts` chama `.unref()` no timer de flush;
  `audit.ts` não. Se `stopAuditWriter()` não for chamado, o timer de auditoria pode
  segurar o processo. O caminho de shutdown chama, mas scripts ad-hoc podem esquecer.
- **`session_id`/`user_id` em `log_events`.** Colunas existem (migração `005`/`006`) mas
  nada as popula. Se algum código futuro as preencher, vira novo tratamento de dado
  pessoal fora do RoPA atual. Decida: remover ou documentar.
- **Sanitização só na camada do logger.** `lib/log-store.ts:buildLogRow` serializa
  `metadata` sem chamar `sanitizeStructuredMetadata`; a sanitização ocorre antes, em
  `logger.ts`. Um chamador direto de `enqueueLogEvent` burlaria a redação. Defesa em
  profundidade recomendada (ver `10-lgpd-compliance-plan.md`, gap 1).
- **`scripts/fetch-missing.ts` e `start-docker-distroless.ts` órfãos.** Sem script npm
  e/ou sem Dockerfile que os use. `fetch-missing.ts` usa `bun:sqlite` cru (não passa por
  `lib/db.ts`), então pula validações de aplicação — embora as triggers da migração
  `007` ainda protejam a unicidade. Considere remover ou documentar como legado.

## Armadilhas para juniores

- **Rodar com Node.** Quebra em `bun:sqlite`. Sempre `bun`.
- **Esquecer `updateNumberFrequencies()`** após importar sorteios → estatísticas
  defasadas.
- **Marcar `'use client'` sem necessidade** → perde renderização no servidor e infla o
  bundle.
- **Editar uma migração já aplicada** → divergência de schema; crie uma nova.
- **Achar que `dist/standalone` sai do `build`** → é `dist:standalone` (passo à parte).
- **Hardcodar cores** → quebra o design system de tokens; use `bg-background`, etc.
- **Hardcodar `megasena-analyzer.com.br`** → use `BASE_URL` de `lib/constants.ts`.

## Perguntas em aberto (precisam de decisão humana)

1. **Retenção de auditoria:** 400 dias (env) vs 365 (CLI) vs recomendação de 180 dias
   da `LGPD-COMPLIANCE.md`. Qual é o alvo oficial?
2. **CSP na borda compartilhada:** a memória do projeto indica que o Traefik impõe uma
   CSP estática compartilhada que `security:csp:edge` acusa; isso é decisão do
   operador (não corrigível por router). Status?
3. **Rotação de backup:** o RoPA (T6) menciona rotação de backups; não há script de
   backup-rotation no repo além de `backup-database.ts` (sem agendamento commitado).
   Onde isso roda?
4. **Política de coleta de `tipoJogo`/campos extras da CAIXA:** normalizados mas não
   totalmente persistidos; confirmar quais colunas de `draws` são de fato preenchidas
   por `pull-draws.ts`.

## Investigações recomendadas

- Rodar `bun run security:secrets:history` antes de releases sensíveis.
- Medir o tempo de `/api/statistics` com todas as flags e o volume atual de `draws`
  (baseline de performance — não há número medido neste documento).
- Auditar o caminho `enqueueLogEvent` para a lacuna de sanitização (gap 1).
- Decidir o destino dos diretórios vazios `app/api/*` (remover ou documentar).

## Como verificar isso no código

```bash
grep -rl "framer-motion\|date-fns" app components lib   # esperado: vazio
grep -rn "user_bets" lib scripts app server.ts | grep -v migrations  # esperado: vazio
grep -rn "ComplexityScoreEngine\|calculateComplexityScore" lib server.ts app components | grep -v "lib/analytics/complexity-score.ts"  # esperado: vazio
find app/api -type f   # esperado: nenhum arquivo (só diretórios)
grep -n "deleted_at" db/migrations/004_audit_logs.sql db/migrations/005_log_events.sql
grep -n "sanitizeStructuredMetadata" lib/log-store.ts   # esperado: ausente
grep -n ".unref()" lib/log-store.ts lib/audit.ts
```

## Mal-entendidos comuns

- **"Se está no `CLAUDE.md`, é verdade no código."** Nem sempre — veja a tabela de
  discrepâncias. Código é a fonte primária.
- **"Tabela no schema = tabela usada."** `user_bets` desmente isso.

## Exercícios

1. **(Fácil)** Confirme por grep que `framer-motion` e `date-fns` não são importados.
2. **(Médio)** Proponha um plano de 3 passos para aposentar a tabela `user_bets` com
   segurança (migração, verificação, doc).
3. **(Difícil)** Implemente a defesa em profundidade do gap de sanitização e prove com
   um teste que metadados com chave `password` saem como `[REDACTED]` ao persistir.

---

### Procedência das afirmações

- **Verificado no código:** todas as discrepâncias e itens de dívida (grep/leitura
  direta dos arquivos citados).
- **Inferido do código:** classificação de "órfão"/"chatty" e impacto de performance
  (sem medição empírica — explicitamente não medido aqui).
- **Conhecimento externo:** notas de infra (Traefik/Coolify/Cloudflare) vêm de docs e
  memória de projeto, não verificáveis apenas pelo código.
