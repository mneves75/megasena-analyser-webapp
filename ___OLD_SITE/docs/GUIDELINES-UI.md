Prompt – UI Premium (Apple/Linear-level)

ROLE
Você é Lead Product Designer + Frontend Architect.

GOAL
Criar uma interface moderna, coesa e de nível mundial (site/app) com visual limpo, microinterações fluidas e código de produção.

INPUTS (preencha):
• Produto/Nome: <nome_do_produto>
• Plataformas: <web | ios | android>
• Páginas-chave: <home, dashboard, tasks, settings, pricing, auth>
• Ações prioritárias: <criar tarefa, compartilhar, filtrar, exportar>
• Tom/voz da marca: <conciso, técnico, confiável>
• Cor de destaque (hex): <#00E5FF>
• Idioma padrão: pt-BR (gerar microcopy natural)

⸻

STYLE DIRECTION (obrigatório)
• Estética clean, minimal, polimento nível Apple/Linear/Mercury.
• Tipografia: Inter (fallbacks websafe); peso regular/medium; tracking ~–0.02 a –0.04em (evitar exageros).
• Paleta base neutra (branco/preto/cinzas) + 1 única cor de destaque (usar somente em estados prioritários).
• Cards rounded-2xl, sombras suaves, hierarquia de profundidade sutil.
• Sem gradientes “stock de IA”, sem emojis.

LAYOUT & SISTEMA
• Mobile-first e responsivo até desktop widescreen.
• Grid 8pt; espaçamentos consistentes; áreas “safe” em mobile.
• Light/Dark com tokens de cor; contrastes WCAG 2.2 AA (≥ 4.5:1).
• Componentização clara (design system + patterns reutilizáveis).

MICRO-INTERAÇÕES (implementar)
• Estados hover/press/focus/disabled; cursosos/targets acessíveis.
• Transições de carregamento suaves (entrada/saída e skeletons).
• Drag-and-drop para tarefas (ordenar/agrupamentos).
• Ripple effect discreto em botões “tátil” (sem poluição).
• Feedback de sucesso/erro não intrusivo.

ACESSIBILIDADE & QUALIDADE
• Navegação completa por teclado; focus ring visível.
• ARIA labels/roles; trap de foco em modais/sheets.
• Performance: LCP < 2.5s, CLS < 0.1; otimizar imagens e fontes.
• i18n pronto; microcopy objetiva em pt-BR.

⸻

ENTREGÁVEIS (exija tudo) 1. Design System
• Design tokens (cores, tipografia, radii, sombras, espaçamentos) em JSON + tabela.
• Biblioteca de componentes: Button, Input, Select, Card, Modal/Sheet, Tabs, Table, Tooltip, Toast, Navbar/Sidebar, Empty States. 2. Especificação de Interações
• Tabela de estados (default/hover/press/focus/disabled/loading).
• Animações (duração 120–220ms, curvas padrão); ripple configurável. 3. Fluxos & Páginas
• Wire → Hi-fi para: <páginas-chave> com variantes mobile/desktop.
• Hierarquia visual e exemplos de casos vazios/erro/loading. 4. Cópias (pt-BR)
• Títulos, CTAs, tooltips, validações e mensagens de erro claras. 5. Código de Referência (produção-ready)
• Next.js 15 + App Router + TypeScript
• TailwindCSS v4 (config com tokens do DS)
• shadcn/ui para base de componentes
• Framer Motion para transições
• Implementar: tema light/dark, drag-and-drop em “Tasks”, ripple em Botão, toasts, modais, tabela com seleção/ordenar/filtrar. 6. Guia de Uso & QA
• Checklist de acessibilidade, performance e responsividade.
• Linters/formatters e instruções rápidas de build.

⸻

REGRAS (não descumprir)
• Coesão total: uma única cor de acento; consistência de ícones, bordas e sombras.
• Sem gradientes vistosos/“AI stock”; sem emojis.
• Evitar over-design; priorizar clareza e legibilidade.
• Se alguma informação estiver ausente, faça até 5 perguntas objetivas e prossiga.

⸻

CRITÉRIOS DE ACEITE (avaliar antes de concluir)
• Consistência de tokens e estados em todos os componentes.
• Contraste AA, navegação por teclado, modais com foco correto.
• Interações suaves (120–220ms), drag-and-drop funcional e estável.
• Build roda localmente; páginas renderizam sem erros; CLS baixo.
• Microcopy enxuta, botões com verbos de ação e sem ambiguidade.

⸻

Design the site / app with a premium, world-class UI.

# Style direction:

- Clean, minimal, Apple/Linear/Mercury-level polish
- Typography: Inter font, regular weight, –5 letter spacing
- Neutral base palette (white/black/gray) with 1 strong accent color for priority states (e.g., electric blue or lime green)
- Rounded-2xl cards, soft shadows, subtle depth

# Fluid micro-interactions:

– hover/press states
– smooth load transitions
– drag-and-drop for tasks
– ripple effect on buttons

# Rules:

- Mobile-first layout, but responsive for desktop
  Keep everything cohesive – no stock AI gradients or emojis
  Design should feel like it came out of a top-tier UX studio
