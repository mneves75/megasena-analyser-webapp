# 001 — Normalizar `draws.draw_date` para ISO (corrige tendências e "última vez visto")

Escrito contra commit: 9d5417f (working tree com redesign não commitado).
Findings: CORRECTNESS-01 (HIGH), CORRECTNESS-02 (HIGH), CORRECTNESS-03 (MED).

## Por que

`draws.draw_date` é TEXT `DD/MM/YYYY` (ex.: `14/07/2026`). SQLite só entende ISO 8601:

1. `lib/analytics/time-series.ts:15-18` usa `strftime('%Y', draw_date)` etc. → retorna NULL para TODAS as linhas → `/api/trends` responde um único bucket `null` com contagens 0. Reproduzido: `sqlite3 db/mega-sena.db "SELECT strftime('%Y', draw_date) FROM draws LIMIT 3"` → vazio.
2. `lib/analytics/statistics.ts:182` e `:208` usam `MAX(draw_date) as last_seen` → máximo LEXICAL. Reproduzido: `MAX(draw_date)` = `31/12/2024`, mas o concurso mais recente (3031) é `14/07/2026`.
3. `lib/utils.ts:33-37` `formatDate()` faz `new Date("DD/MM/YYYY")` → `Invalid Date` (landmine sem chamadores hoje).

## Mudanças (ordem)

1. **Migração** `db/migrations/00X_draw_date_iso.sql` (numere após a última existente — verifique `ls db/migrations/`):
   ```sql
   UPDATE draws
   SET draw_date = substr(draw_date,7,4) || '-' || substr(draw_date,4,2) || '-' || substr(draw_date,1,2)
   WHERE draw_date LIKE '__/__/____';
   ```
   Idempotente (o WHERE não casa datas já ISO). Siga o formato das migrations existentes (header/comentários).
2. **Ingestão**: `scripts/pull-draws.ts:65` e `scripts/fetch-missing.ts:50` gravam `draw.dataApuracao` cru (DD/MM/YYYY vindo da CAIXA). Converter para ISO na inserção (helper compartilhado, ex.: `lib/utils.ts` `toIsoDate(brDate: string): string` com validação estrita `DD/MM/YYYY` e throw em formato inesperado).
3. **`formatDate`** em `lib/utils.ts:33-37`: passar a assumir entrada ISO (`YYYY-MM-DD`) e retornar pt-BR `DD/MM/YYYY` via `Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })` (sem lib nova; cuidado com off-by-one de timezone — parse como UTC).
4. **UI**: todo lugar que renderiza `drawDate`/`lastDrawDate` cru passa a usar `formatDate`: `app/page.tsx` (~linha 290, painel do último sorteio), `app/dashboard/page.tsx` (~147 e lista de últimos sorteios), `app/dashboard/statistics/page.tsx` (~210 base de referência e cards de padrões), e qualquer outro achado por grep `drawDate|draw_date|lastDrawDate` em app/ e components/.
5. **API/health**: `server.ts` health inclui `lastDrawDate` — decidir: manter ISO no JSON (consumidor `scripts/check-production-freshness.ts` — verifique se ele parseia; se só imprime, ISO ok) e formatar apenas na UI. Preferir ISO no wire.
6. **Queries**: trocar `MAX(draw_date)` em `lib/analytics/statistics.ts:182,208` por subselect por concurso: `(SELECT draw_date FROM draws WHERE <mesma condição> ORDER BY contest_number DESC LIMIT 1)`. (Com datas ISO o MAX passaria a funcionar, mas por concurso é semanticamente correto e imune a datas iguais.)
7. **InMemoryDatabase** (`lib/db.ts`): o mock normaliza algumas queries por prefixo; verifique se as queries alteradas ainda casam (ajuste o mock se necessário — ele já implementa "last seen" por contest_number em `lib/db.ts:426-442`).

## Testes

- Novo teste de integração com DB real: `tests/lib/analytics/time-series.file.test.ts` seguindo o padrão de `tests/lib/analytics/delay-analysis.file.test.ts` (usa `VITEST_FORCE_FILE_DB=1` internamente — copie o mecanismo). Seed com draws em ISO, assert buckets anuais/mensais não-nulos e contagens corretas.
- Teste de `toIsoDate` (casos: válido, inválido, já-ISO deve lançar ou retornar igual — defina contrato e teste).
- Teste de `formatDate` ISO→pt-BR incluindo fronteira de timezone (data não pode deslocar um dia).
- Regressão para o MAX lexical: seed com datas que quebravam (ex.: 31/12/2024 vs 14/07/2026) e assert last_seen correto.

## Verificação (gates)

```
bun run lint            # zero warnings
bun run typecheck       # zero erros
bun run test -- --run   # tudo verde
bun run db:migrate      # aplica migração no db local sem erro
sqlite3 db/mega-sena.db "SELECT strftime('%Y', draw_date) FROM draws ORDER BY contest_number DESC LIMIT 1;"  # → 2026
sqlite3 db/mega-sena.db "SELECT COUNT(*) FROM draws WHERE draw_date LIKE '__/__/____';"  # → 0
```

## Fora de escopo

- NÃO tocar em audit_logs/log_events (timestamps já ISO).
- NÃO mudar o formato de exibição pt-BR (usuário vê DD/MM/YYYY como hoje).
- NÃO reescrever o InMemoryDatabase além do mínimo para as queries alteradas.

## Escape hatch

Se `scripts/check-production-freshness.ts` fizer parsing dependente de DD/MM/YYYY do health, PARE e reporte antes de mudar o formato do wire.
