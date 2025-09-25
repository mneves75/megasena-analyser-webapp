# Manual de Instalação e Setup Local

> Atualizado em 24/09/2025 – mantenedor: React Server Components Expert.

Este manual descreve o processo completo para preparar um ambiente local de desenvolvimento do **Mega-Sena Analyzer**. Siga cada passo em ordem para evitar inconsistências no banco de dados ou no runtime.

---

## 1. Pré-requisitos

| Ferramenta      | Versão recomendada | Observações                                              |
| --------------- | ------------------ | -------------------------------------------------------- |
| Node.js         | 22.x LTS           | Next.js 15 usa módulos nativos; evite versões < 18.18.0. |
| npm             | 10.x (bundled)     | Alinhado ao Node 22.                                     |
| SQLite          | 3.x                | Utilizado pelo Prisma (arquivo `dev.db`).                |
| Git             | 2.4+               | Necessário para clonar o repositório.                    |
| curl (opcional) | 7.x                | Útil para testar endpoints manualmente.                  |

> **Dica:** use `nvm` ou `fnm` para gerenciar múltiplas versões de Node.

---

## 2. Clonagem do repositório

```bash
git clone git@github.com:mneves75/megasena-analyser-webapp.git
cd megasena-analyser-webapp
```

---

## 3. Instalação de dependências

```bash
npm install
```

- O projeto não utiliza `pnpm` nem `yarn`; mantenha `npm` para garantir consistência com o `package-lock.json`.
- Após a instalação, o Husky (hooks de commit) é configurado automaticamente via `npm run prepare`.

---

## 4. Configuração de variáveis de ambiente

1. Copie o modelo existente:

   ```bash
   cp .env.sample .env
   ```

2. Edite o arquivo `.env` garantindo **uma variável por linha**:

   ```env
   DATABASE_URL="file:./dev.db"
   SYNC_TOKEN=local-sync-token
   LOG_LEVEL=info
   # Ative apenas em scripts CLI (não durante next dev)
   # LOG_PRETTY=1
   MEGASENA_BASE_PRICE_CENTS=600
   MEGASENA_PRICE_FALLBACK_UPDATED_AT=2025-07-12T00:00:00Z
   SYNC_BACKFILL_WINDOW=50
   ```

3. Valide se o `DATABASE_URL` começa com `file:`; o script de sincronização abortará caso contrário.

---

## 5. Preparação do banco de dados

Execute migrations e seeds iniciais:

```bash
npm run db:migrate
npm run db:seed
```

- O seed popula a tabela `Price` com valores combinatórios oficiais e insere metadados (`schema_version`, `price_last_checked`).
- Avisos sobre `package.json#prisma` são esperados até migrarmos para `prisma.config.ts`.

### (Opcional) Resetar o banco

Use quando quiser reprocessar todo o histórico:

```bash
npm run db:reset   # recria o SQLite
npm run db:seed    # repopula preços/metadados
```

---

## 6. Sincronização de concursos

Aplique um backfill completo antes de testar a UI:

```bash
npm run sync -- --full --limit=4000
```

- `--full` sinaliza que queremos voltar no tempo a partir do concurso mais recente.
- `--limit` define quantos concursos retroativos buscar (4000 cobre todo o histórico até setembro/2025).
- Logs são emitidos via `pino`; se quiser saída legível em CLI, execute com `LOG_PRETTY=1 npm run sync -- --full --limit=4000`.
- Para atualizar apenas concursos novos em execuções posteriores, rode `npm run sync` sem flags.

Verifique o total de concursos após o processo:

```bash
sqlite3 dev.db 'select count(*) from Draw;'
```

---

## 7. Scripts auxiliares

| Comando                                                                                              | Finalidade                                                     |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `npm run limits -- --show`                                                                           | Exibe os limites dinâmicos (k, orçamento, tickets).            |
| `npm run limits -- --set=maxTicketsPerBatch=120`                                                     | Atualiza limites com auditoria automática.                     |
| `NODE_OPTIONS="-r ./scripts/dev/register-server-only-stub.js" npx tsx scripts/dev/generate-batch.ts` | Gera uma amostra de apostas via CLI (usa seed `FIXTURE-SEED`). |

Todos os scripts registram log em JSON; use `LOG_PRETTY=1` caso queira legibilidade durante execuções locais.

---

## 8. Rodando o servidor de desenvolvimento

Há duas opções:

1. **Webpack (recomendado enquanto o Turbopack possui bug com `thread-stream`):**

   ```bash
   npx next dev
   ```

2. **Turbopack (padrão do projeto):**
   ```bash
   npm run dev
   ```
   Se ocorrer o erro `Cannot find module '/ROOT/node_modules/thread-stream/lib/worker.js'`, finalize o processo, apague `.next` e retorne à opção 1 ou exporte `NEXT_DISABLE_TURBOPACK=1 npm run dev`.

A aplicação fica disponível em <http://localhost:3000>.

---

## 9. Verificações pós-setup

1. **Lint & Tipos**
   ```bash
   npm run lint
   npm run typecheck
   ```
2. **Build de produção**
   ```bash
   npm run build
   ```
3. **Teste do gerador**
   - Acesse `/generate`, informe orçamento (R$ 100,00) e seed qualquer.
   - Garanta que os tickets aparecem e são persistidos (rota `/bets`).

---

## 10. Problemas comuns

| Sintoma                        | Causa provável                                    | Solução                                                                                       |
| ------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL` inválido        | Variáveis no `.env` na mesma linha                | Reformatar `.env` (uma variável por linha).                                                   |
| `ENOENT _buildManifest.js.tmp` | Bug conhecido do Turbopack                        | Limpar `.next`, rodar `npx next dev` ou seguir o plano em `docs/DEV_SERVER_RECOVERY_PLAN.md`. |
| Gerador não responde           | Logger tentando usar `pino-pretty` dentro do Next | Certifique-se de não exportar `LOG_PRETTY=1` ao iniciar `next dev`.                           |
| Falta de concursos na UI       | Banco sem sync completo                           | Executar `npm run sync -- --full --limit=4000`.                                               |

---

## 11. Próximos passos após o setup

- Consulte `docs/TEAM_ONBOARDING_GUIDE.md` para entender arquitetura, convenções e fluxo de trabalho.
- Leia `docs/PHASE5_STAGE6_ROADMAP.md` e `docs/STAGE6_UI_DELIVERY_PLAN.md` para acompanhar as próximas entregas.
- Registre quaisquer anomalias no `docs/DEV_SERVER_RECOVERY_PLAN.md` ou abra issue correspondente.

> Em caso de dúvidas, abra um tópico no canal #megasena-app (interno) citando o trecho deste manual que gerou bloqueio.
