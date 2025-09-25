# Plano de Recuperação do Dev Server – ENOENT `_buildManifest.js.tmp`

> Atualizado em 23/09/2025 – responsável atual: React Server Components Expert.

## 1. Contexto

- Ambiente: Next.js 15.5.3 (Turbopack) em modo `npm run dev`.
- Sintoma: erros recorrentes `ENOENT` ao abrir arquivos `.next/static/development/_buildManifest.js.tmp.*` após iniciar o servidor, apesar do bootstrap funcionar parcialmente.
- Suspeita inicial: corrida durante escrita/limpeza de temp files do Turbopack + watchers (`next dev`) ou concorrência com processo anterior.

## 2. Hipóteses

1. **Processo antigo zombie**: instância prévia de `node` segurando locks em `.next/static/development`.
2. **Permissões/limpeza**: residual em `.next/static` impedindo criação dos arquivos temporários.
3. **Bug de Turbopack**: conhecido quando diretório `.next/static/development` não existe ou é limpo em runtime.
4. **Extensão browser** interferindo\*\*: menos provável, mas relatado por Next.

## 3. Passos de Mitigação Imediatos

1. **Encerrar processos conflictuantes**
   - `lsof -Pi :3000` para identificar PIDs > matar instâncias antigas com `kill -9 <pid>` se necessário.
2. **Limpar build artifacts**
   - `rm -rf .next` e `npm run dev` novamente.
3. **Verificar permissões**
   - Garantir que o usuário atual tem permissão de escrita no repo (geralmente já verdade em dev local).
4. **Habilitar verbose logging**
   - Rodar `NEXT_DISABLE_TEMPLATE_CACHE=1 npm run dev` (ajuda diagnosticar fallback do Turbopack).

## 4. Plano Iterativo

### Iteração A – Higienização e restart _(concluída 23/09/2025)_

- [x] Parar servidor (`kill 32229`) e verificar porta 3000 livre (`lsof -Pi :3000`).
- [x] Deletar `.next` e reiniciar `npm run dev`.
- [x] Requisição GET manual (`curl http://localhost:3000`) sem reaparecimento do erro; logs em `/tmp/next-dev.log` confirmam ausência de `ENOENT`.

### Iteração B – Isolar bug Turbopack _(opcional no momento)_

- [ ] Rodar `npm run dev -- --no-turbo` e comparar comportamento (apenas se o erro reaparecer).
- [ ] Alternativamente, testar `NEXT_PRIVATE_TURBOPACK=0` para reproduzir a falha.

### Iteração C – Reporte / Issue tracking _(aguardando)_

- [ ] Apenas necessário caso a falha retorne com frequência após Iteração A ou B.

## 5. To-Do resumido

- [x] Higienizar `.next` e reiniciar dev server.
- [ ] Reproduzir com Turbopack desabilitado (`npm run dev -- --no-turbo`) se o erro voltar.
- [ ] Documentar observações no README > seção “Troubleshooting dev server”. _(próximo passo)_
- [ ] Acompanhar aviso Prisma (`package.json#prisma` deprecado) – mover config para `prisma.config.ts` (tarefa futura).

## 6. Observações adicionais

- Aviso Prisma não quebra fluxo, mas marcar para próxima rodada de manutenção.
- Monitorar se novos scripts (p.ex. CLI de limites) interagem com `.env` e podem rodar em paralelo com `next dev`.
- Caso usem browsers com Extensões (React DevTools) que alterem DOM antes da hidratação, confirmar se não interferem – embora o erro atual seja antes da renderização.

---

> Atualizar este plano após cada tentativa, registrando o resultado (sucesso/falha) e logs relevantes.
