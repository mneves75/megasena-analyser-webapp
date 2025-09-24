# UI Redesign Review — 24/09/2025

## Escopo da revisão

- Páginas principais: Home (`src/app/page.tsx`), Stats (`src/app/stats/page.tsx`), Generate (`src/app/generate/page.tsx`), Bets (`src/app/bets/page.tsx`).
- Componentes de suporte introduzidos no redesign: `AppShell`, `StatList`, `BetGeneratorForm`, componentes `ui/*`.
- Documentação e planos existentes (`docs/UI_REDESIGN_ACTION_PLAN.md`, README, CHANGELOG).

## Achados relevantes

1. **Home / Highlights** (`src/app/page.tsx:16-210`)
   - Valor do “Preço base oficial” exibe `priceK6.fonte` dentro do texto mas sempre renderiza, inclusive quando fonte é `env:...`, quebrando a fluidez da copy.
   - Lista “Números em destaque” repete tooltip textual; pode ser convertida em tabela com ranking/variação.
2. **Stats Dashboard** (`src/components/dashboard/stats-dashboard.tsx`)
   - `StatList` recém-criado atende hot/cold numbers, mas falta um resumo compacto (ex.: média geral) e CTA/link para `/stats` filtros.
   - Se não houver dados, os componentes exibem cartões vazios; precisamos de fallback usando `EmptyState`.
3. **Gerador (`BetGeneratorForm`)** (`src/components/forms/bet-generator-form.tsx`)
   - Ainda não há componente TicketBadges: dezenas exibidas como uma lista longa sem agrupamento semântico.
   - Resultado ocupa 2 colunas em desktop; em mobile ainda gera scroll vertical grande. Avaliar collapse/accordion por bilhete.
   - Botão “Exportar payload” usa `buttonStyles("secondary")`; deveria virar variante `ghost` + ícone à direita para reduzir hierarquia visual.
4. **Histórico (`src/app/bets/page.tsx`)**
   - Fase D totalmente pendente: sem filtros, sem agrupamento por data, CTA do `EmptyState` fora do componente.
   - Seeds completas exibidas; planejar mascaramento e tooltip copy-to-clipboard.
5. **Componentes globais**
   - `Button` permanece com ripple (não removido). Precisa de variantes padronizadas (primary/secondary/ghost link) e estados focos/hovers revistos.
   - `Card` ainda usa um único espaçamento padrão; faltam variantes `compact`/`comfortable` para dashboards versus conteúdo textual.
6. **Docs & registros**
   - `docs/UI_REDESIGN_ACTION_PLAN.md` atualizado parcialmente; precisamos refletir novas descobertas (fallbacks, ripple, TicketBadges) e adicionar critérios de aceitação revisados.
   - README carece de prints/links para o novo StatList/Ticket workflow; anotar para quando UI estabilizar.

## To-Do consolidado

1. **Home**
   - [ ] Ajustar descrição do preço base para ocultar fonte quando for `env:`; expor fonte apenas quando oficial (CAIXA) ou adicionar label humanizado.
   - [ ] Converter “Números em destaque” em lista com ranking + micro métricas (variação, tempo desde última aparição) usando `StatList` ou tabela dedicada.
2. **Stats Dashboard**
   - [ ] Adicionar fallback `EmptyState` quando listas estiverem vazias (ex.: banco recém-populado).
   - [ ] Incluir link/contexto para filtros avançados (futuro Stage 6) e CTA para `/generate` usando insights.
3. **Gerador**
   - [ ] Implementar `TicketBadges` (grid responsiva, padrão 3 colunas mobile / 6 desktop) e substituir rendering atual.
   - [ ] Revisar hierarquia das ações pós-resultado (primária: salvar ou gerar novamente; secundárias: exportar JSON, ver histórico).
   - [ ] Considerar accordion detalhado por ticket com metadados (seed, estratégia, score) conforme payload.
4. **Histórico**
   - [ ] Desenvolver filtros por estratégia/data (UI + reuso de serviços) e agrupar cartões por data.
   - [ ] Integrar CTA ao `EmptyState` via prop `action` em vez de wrapper manual; mascarar seed (`ABC123…XYZ`).
5. **Componentes**
   - [ ] Remover ripple do `Button` e garantir estilos estáveis (hover/focus sem deslocamento).
   - [ ] Introduzir variantes de `Card` (ex.: `compact`, `dashboard`) para controlar padding/tons consistentemente.
   - [ ] Criar utilitário `Stack` (layout vertical com gaps padronizados) para substituir `space-y-*` duplicado.
   - [ ] Revisar tokens (line-height, letter spacing) em `globals.css` conforme guidelines.
6. **Docs / Changelog**
   - [ ] Atualizar `docs/UI_REDESIGN_ACTION_PLAN.md` com estes itens e redefinir cronograma (Fases D/E + revisões adicionais).
   - [ ] Preparar seção de notas visuais no README com screenshots após finalização das próximas fases.

> Próxima etapa sugerida: atacar os itens da Fase D (Histórico) em conjunto com a criação do componente `TicketBadges`, mantendo lint/build green a cada bloco.
