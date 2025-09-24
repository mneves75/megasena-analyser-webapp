# Stage 6 · Plano de Entrega da Interface Web

> Atualizado em 23/09/2025 — elaborado após revisão "fresh eyes" das rotas `app/`.

## 1. Achados da Revisão

- Home (`src/app/page.tsx`) apresenta apenas cópia institucional; nenhum bloco consome os serviços reais (`stats`, `bets`, `pricing`).
- Rotas `stats`, `generate`, `bets` exibem checklists estáticos sem conexão com dados do banco, mesmo após os serviços Stage 5 terem sido concluídos.
- Links de documentação (`REPO_BASE`) apontam para `seu-usuario/...`, quebrando acesso direto aos arquivos no GitHub remoto `mneves75/megasena-analyser-webapp`.
- Tema claro/escuro foi estabilizado, porém o toggle ainda renderiza ícone "sol" no SSR e troca para "lua" pós-hidratação quando a preferência é "dark"; precisamos validar novamente após injetar novos Client Components.
- Nenhum surface reutiliza componentes recém-adicionados em `src/components/ui/**` (`Chart`, `EmptyState`, `Loading`, etc.), o que mantém a UI subutilizada e dificulta validação funcional.

## 2. Objetivo de Stage 6 (frontend)

Entregar uma primeira versão navegável das features core (Stats dashboard, Gerador de apostas, Histórico) usando os serviços existentes, mantendo App Router com Server Components por padrão e Client Components apenas onde houver interação direta (forms, toggles, gráficos).

## 3. TODO Prioritário

- [x] Corrigir `REPO_BASE` nas páginas `stats` e `docs` para apontar para `https://github.com/mneves75/megasena-analyser-webapp`.
- [x] Exibir resumo estatístico real na Home (ex.: top 6 frequências + data de atualização), reutilizando os tokens do `Card`.
- [x] Integrar `stats` page com `getFrequencies`, `getPairs`, `getSums` mostrando tabelas/mini-charts em Server Components + fallback `Loading` client-side.
- [x] Criar formulário em `generate` consumindo `generateBetsAction` (Server Action) com validações client-friendly (`useActionState` + componentes `Input`, `Select`).
- [x] Renderizar listagem paginada de apostas em `bets` via Server Component que chama `listBets` (com `EmptyState` para bancos vazios).
- [x] Garantir cobertura manual: `npm run lint`, `npm run typecheck`, `npm run test -- bets strategies pricing`, `npm run build`.
- [x] Validar toggle de tema após as mudanças (inspeção de `layout.tsx` + build sem `Hydration failed`).
- [x] Atualizar README > seção "Visão geral da UI" com fluxos principais.
- [x] Entregar landing page moderna otimizada para conversão seguindo persona Hormozi indicada, incluindo menu para as funcionalidades (`Início`, `Estatísticas`, `Gerar Apostas`, `Histórico`, `Docs`).
  - [x] Conduzir discovery em etapas (nome da empresa, serviço específico, cliente ideal) antes de produzir o HTML.
  - [x] Construir página completa (HTML+CSS+JS inline) em pt-BR com paleta quente (sem gradientes azul/roxo) e cumprir requisitos de performance/acessibilidade (`public/conhecendotudo-landing.html`).
  - [x] Copiar headline e copy no formato "Obtenha [resultado] sem [frustração]" com métricas/garantia reais ou placeholders a validar.
  - [x] Incluir CTA primária "Garanta seu [benefício específico] gratuito" e CTA secundária "Ver resultados" ou similar, ambos alinhados ao serviço identificado.

## 4. Sequenciamento Proposto

1. **Infra mínima (Dia 1)**
   - Ajustar links e criar componentes compartilhados (cards de métricas, tabela padrão `StatsTable`).
   - Definir `loading.tsx` e `error.tsx` nas rotas que passarem a executar chamadas assíncronas.
2. **Stats Dashboard (Dia 2)**
   - Implementar Server Components `TopFrequencies`, `PairHeatmapSummary`, `SumsDistribution`.
   - Introduzir `Suspense` + `Loading` para cubrir latência do banco.
3. **Gerador interativo (Dia 3)**
   - Formulário com campos orçamento/estratégia/seed opcional.
   - Mostrar resultado (cards de tickets) reutilizando o schema de payload; permitir exportar JSON.
4. **Histórico persistido (Dia 4)**
   - Tabela paginada usando `listBets` + filtro por estratégia.
   - Adicionar botões "Ver detalhes" abrindo modal com payload.
5. **Polimento & QA (Dia 5)**
   - Validar dark mode, responsividade, estados de vazio/erro.
   - Atualizar documentação e gravar walkthrough curto.

## 5. Dependências & Recursos

- Banco populado (`npm run db:seed` + sincronização recente) para demonstrar estatísticas reais.
- Scripts CLI existentes (`npm run generate:sample` se aplicável) para produzir dados de teste.
- Componentes utilitários recém-criados (`src/components/ui/empty-state.tsx`, `loading.tsx`, `chart.tsx`) devem ser finalizados/revisados antes de uso intensivo.

## 6. Medidas de Aceite

- Home exibe pelo menos um bloco dinâmico (estatísticas + timestamp) e CTA levam a fluxos funcionais.
- `stats`, `generate`, `bets` carregam dados sem erros em ambiente com banco real.
- Testes unitários e build continuam verdes; nenhum aviso ESLint.
- Não há logs de hidratação/diff ao alternar temas ou navegar entre rotas.
- README/documentação refletem a UI entregue (prints, instruções de uso).

## 7. Riscos & Mitigações

- **Perf latência**: consultas agregadas podem pesar; utilizar `cache()` + limites `window` padrão.
- **Experiência com DB vazio**: renderizar `EmptyState` descritivo com instruções para rodar `npm run sync`.
- **Complexidade Client Components**: manter formulário/visualizações isolados; preferir Server Components para leitura.

## 8. Próximas iterações previstas

- Depois do MVP navegável, integrar gráficos (Chart.js ou Tremor) e backtesting conforme roadmap Stage 6.
- Considerar telemetry (Vercel Analytics/Logflare) para monitorar uso das novas rotas.
- Avaliar criação de `docs/UI_RELEASE_NOTES.md` para acompanhar evolução visual em cada sprint.

> Atualize esta página ao concluir cada bloco, marcando checkboxes e anexando links para PRs/screenshots relevantes.
