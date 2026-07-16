# 003 — Cache em memória por concurso para /api/statistics e /api/dashboard

Escrito contra commit: 9d5417f. Findings: PERF-01 (HIGH), SECURITY-01 (MED — DoS por exaustão de CPU).

## Por que

- `server.ts:502-581` (`/api/statistics`) instancia ~8 engines e re-executa TODAS as agregações a cada GET; `server.ts:478-500` (`/api/dashboard`) idem. Dados mudam só quando entra concurso novo (~2×/semana).
- `bun:sqlite` é síncrono: requests caros bloqueiam o event-loop inteiro → GET barato e não autenticado vira vetor de DoS (rate limit 100/min/IP não impede saturação com poucas conexões).
- As páginas Next usam `force-dynamic` + `no-store` (contrato: API no-store é by-design; o cache deve viver DENTRO do processo da API, não em HTTP).

## Mudanças

1. Novo módulo `lib/api/response-cache.ts`: cache Map em memória keyed por `(rota + query canônica)` com validador por `lastContestNumber`:
   - Na entrada do handler: obter `lastContestNumber` (query barata e única: `SELECT MAX(contest_number) FROM draws` — já existe helper?; se não, criar).
   - Hit: se entry.contest === atual, retornar o JSON serializado cacheado (armazenar a STRING serializada para evitar re-stringify e mutação acidental).
   - Miss: computar, armazenar `{contest, body}` e retornar.
   - Limitar tamanho (ex.: máx. 32 entries, evict mais antigo) — a combinação de flags de /api/statistics é enumerável mas defensivo.
2. Aplicar em `/api/statistics` e `/api/dashboard` em `server.ts`. NÃO aplicar em `/api/health` (precisa refletir estado vivo).
3. Headers continuam `Cache-Control: no-store` (contrato do projeto — o cache é interno ao processo, não HTTP).
4. Invalidação natural: quando `pull-draws` roda em outro processo, este processo detecta pelo `MAX(contest_number)` a cada request (validador barato). Nenhum TTL necessário; adicione TTL defensivo de 10min apenas se trivial.

## Testes

- Unit do `response-cache`: hit/miss por concurso, invalidação quando o concurso muda, eviction.
- Teste de integração leve: dois GETs seguidos em `/api/statistics` retornam o mesmo corpo e o segundo não re-executa engines (spy/contador injetável ou log).

## Verificação

```
bun run lint && bun run typecheck && bun run test -- --run
```

## Fora de escopo / Cuidados

- Preservar EXATAMENTE o shape do JSON atual (as páginas parseiam).
- Preservar a ordem dos wrappers de segurança (`withRequestIdHeader`, rate limit) — cache entra DENTRO do handler, depois das validações de método/rate limit.
- NÃO cachear respostas de erro.
