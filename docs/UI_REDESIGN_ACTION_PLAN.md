# Plano de Redesign de Layout · Mega-Sena Analyzer

> Atualizado em 24/09/2025 – responsável: React Server Components Expert.

## 1. Diagnóstico (24/09/2025)

### Home (`src/app/page.tsx`)

- Grid inicial alterna `1fr / 360px`, gerando coluna lateral muito alta e estreita em >1440px.
- Lista de destaques (4 cards) em layout `lg:grid-cols-4` dentro de container estreito → textos quebram em 3 linhas.
- Cartão “Números em alta” usa espaçamento reduzido (px-3) e fonte XS, prejudicando leitura.
- Sessão CTA final usa padding desigual (px-6 / sm:px-8) com animações que geram deslocamento perceptível.

### Dashboard de estatísticas (`src/app/stats/page.tsx`)

- Cards resumidos (total, soma, quadrante) compactados em 4 colunas; em viewport média ficam muito estreitos.
- Grafos `Chart` esticam 300px de altura independentemente do container → overflow vertical em laptops.
- Seções “Números quentes/frios” repetem componentes quase idênticos; falta alinhamento vertical (Progress à direita sem descrições).
- Falta breadcrumb/heading com espaçamento vertical consistente (gap-8 fixo).

### Gerador (`src/app/generate/page.tsx` + formulário)

- Formulário ocupa largura total; inputs 12rem de altura com radius 2xl → sensação de blocos gigantes.
- Cards resultantes listam dezenas em linha sem quebra adaptativa; em mobile overflow horizontal.
- CTA secundária (“Exportar payload”) e link “Ver histórico” usam `Button` com ripples, poluindo foco principal.

### Histórico (`src/app/bets/page.tsx`)

- Cards ocupam 100% largura com padding mínimo; meta info (seed, tickets) está em texto XS pouco legível.
- `EmptyState` sem CTA dedicada, exige link adicional fora do componente.
- Cards repetem `ID` completo sem máscara; layout sem agrupamento por data.

### Componentes globais

- `Card` carece de densidades definidas (mesmo espaçamento para dashboards e conteúdo). Falta utilitário `cardSpacing`.
- `Button` com ripple aumenta altura visual e pode causar deslocamentos ao pressionar.
- `Tooltip`/`Modal` criados mas não padronizados; precisam de tokens comuns.

## 2. Objetivos

1. Melhorar legibilidade e respiro entre blocos críticos (hero, dashboards, formulários).
2. Garantir responsividade fluida (breakpoints XS, MD, LG) com largura máxima 1200px e gutters consistentes (24px desktop).
3. Padronizar componentes (`Card`, `Button`, `Badge`, listas) para densidade coerente.
4. Reduzir movimento desnecessário (animações) e assegurar estabilidade durante load.

## 3. Guia de Redesign (Prioridade Alta → Média)

### Fase A – Layout e tipografia (alta prioridade)

- [x] Introduzir container global com `max-w-5xl` (~1120px) e gutters 24/32px, aplicando em `AppShell`.
- [x] Ajustar grid da Home: hero 2 colunas só em `xl` (>=1280), highlights em `md:grid-cols-2, xl:grid-cols-4` com `min-h-[160px]` e `text-base`.
- [x] Atualizar sessão “Números em alta” com cards horizontais (avatar + info + badges) e espaçamento 16px.
- [x] Reduzir animações `animate-slide-up` para apenas CTA final ou remover até novo guideline.

### Fase B – Dashboard de estatísticas

- [x] Reorganizar cards superiores em 2 colunas (sm) e 4 colunas apenas >=1536px; aumentar padding interno.
- [x] Criar componente `StatList` para números quentes/frios (tabela responsiva) substituindo estruturas antigas.
- [x] Ajustar `Chart` para comportar altura responsiva (`h-[220px]` mobile, `h-[260px]` desktop) com padding adequado.
- [x] Adicionar fallback `EmptyState` quando não houver dados e linkar para `/generate` com base nos insights.

### Fase C – Gerador de apostas

- [x] Dividir formulário em duas colunas somente >=1024px; inputs menores (`h-11`, radius `xl`).
- [x] Implementar componente `TicketBadges` com grid responsiva (wrap de 3 colunas mobile, 6 desktop).
- [x] Mover CTAs secundárias para barra inferior com `Button` variante `link`, mantendo primária destacada.
- [x] Ajustar hierarquia das ações pós-resultado (Salvar/Regenerar) e oferecer opção de detalhar bilhete (accordion / drawer).

### Fase D – Histórico

- [x] Adicionar filtros básicos (strategy select, datas) acima da lista.
- [x] Agrupar cartões por data (seção com heading) e aplicar layout `grid md:grid-cols-2`.
- [x] Substituir texto XS por `text-sm`, seed mascarada (`seed.slice(0,6)…`).
- [x] Integrar CTA no `EmptyState` via prop `action` (já existente) com `LinkButton` reutilizável.

### Fase E – Componentes compartilhados

- [x] Definir `cardVariants` (`compact`, `comfortable`) e aplicar nas páginas.
- [x] Atualizar `Button` para remover ripple e reforçar estados hover/focus.
- [x] Criar `Stack` utilitário (`flex flex-col gap-6 sm:gap-8`) para seções, reduzindo repetição.
- [x] Revisar tokens em `globals.css` (line-height, font-size base 15px? → manter 16px, ajustar heading letter-spacing).

### Backlog complementar

- [x] Ajustar descrição do preço base na Home para ocultar fontes técnicas (`env:`) e exibir rótulos legíveis.
- [x] Converter “Números em destaque” da Home para ranking reutilizando `StatList` (incluindo variação / tempo desde última aparição).
- [ ] Atualizar README com prints Light/Dark quando o redesign estiver completo.

## 4. Critérios de Aceite

- Tipografia: headings ≤3 linhas, body text legível em 14–16px.
- Espaçamento vertical mínimo 24px entre seções; componentes dentro de cards com padding ≥20px.
- Sem overflow horizontal em breakpoints 360px, 768px, 1024px.
- Lighthouse (mode desktop) layout shift < 0.05.

## 5. Próximos Passos

1. Implementar Fase A (layout base) e validar em Home/Stats.
2. Fase B + C em sequência, sempre rodando `npm run lint`/`build` com screenshots (Light/Dark).
3. Atualizar README (UI) e docs com novas capturas ao final.
4. Registrar métricas antes/depois (audit log em docs/UI_REDESIGN_ACTION_PLAN.md).

> Revisar plano com John Carmack antes de avançar para Fase B caso Fase A não entregue melhoria perceptível.
