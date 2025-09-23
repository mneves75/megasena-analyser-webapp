# Plano de Correção — Sync Mega-Sena

## Diagnóstico Atual

- Erro ao rodar `npm run sync`: Prisma acusa `DATABASE_URL` sem protocolo. O `.env` ficou com `DATABASE_URL="file:./dev.db"SYNC_TOKEN=...`, ou seja, sem quebra de linha entre as variáveis.
- Scripts e README não alertam para manter cada variável em linha separada.
- Precisamos garantir que os comandos CLI (e futuros deployments) validem a presença de `file:` e newline correto.

## Plano de Ação

1. **Sanear `.env`**
   - Reescrever o arquivo garantindo uma linha por variável.
   - Adicionar comentário orientando sobre a necessidade de manter cada var em linha separada.
2. **Automatizar ao adicionar tokens**
   - Criar helper script ou instrução que assegure newline ao acrescentar variáveis via CLI.
3. **Atualizar documentação**
   - README: mostrar bloco `.env` com variáveis relevantes, destacando newline obrigatória e exemplo completo.
   - Plano de implementação: marcar item relacionado a logs/env revisado.
4. **Validação preventiva**
   - Adicionar step rápido no CLI (`scripts/sync.ts`) que valida `DATABASE_URL` começa com `file:` antes de instanciar Prisma e lança mensagem clara.
5. **Teste manual**
   - Após ajustes, rodar `npm run sync -- --limit=1` e `--full --limit=50` para confirmar ingestão.

## TODO Tracker

- [x] Reescrever `.env` garantindo formatação correta e comentario.
- [x] Ajustar README com exemplo de `.env` formatado.
- [x] Adicionar validação de `DATABASE_URL` no script `scripts/sync.ts`.
- [x] Executar `npm run sync -- --limit=1` (fumaça) e `npm run sync -- --full --limit=50` para confirmar.
