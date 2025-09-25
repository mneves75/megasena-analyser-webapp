# Generate Page Polish Plan (2025-09-25)

## Context

- Feedback aponta que: (1) a grade de bilhetes invade o cabeçalho ao rolar; (2) a coluna de estratégia exibe ids em inglês; (3) os botões de copiar ficam desalinhados após os números; (4) metadados úteis (seed, score) ficam espremidos.
- Ajustes devem preservar a arquitetura atual (App Router + React Data Grid) e manter acessibilidade/responsividade.

## Objetivos

1. Ajustar rolagem da grade sem encobrir título/descrição.
2. Localizar valores de estratégia para pt-BR.
3. Reposicionar/alinhar botões de cópia antes das dezenas.
4. Ampliar o espaço de metadados (colunas, painel extra, ou modal).

## Plano Iterativo

### Iteração A — Scroll & Layout

- [x] Revisar containers (`Stack`, `Card`, wrapper do grid) e aplicar `scroll-margin-top`/padding adequado.
- [x] Isolar grid em contêiner com `overflow` próprio e validar cabeçalho sticky.
- [ ] QA manual: rolagem com mouse/trackpad em temas claro/escuro.

### Iteração B — Localização da coluna Estratégia

- [x] Criar mapper `strategyToLabel` reutilizável; garantir fallback para ids desconhecidos.
- [x] Atualizar colunas do grid e payload JSON exportado.
- [x] Adicionar testes (unit ou snapshot) confirmando tradução em todas as estratégias.

### Iteração C — Reposicionamento do botão Copiar

- [x] Refatorar célula de dezenas para layout flex alinhando botão antes do número (ícone + label).
- [x] Garantir foco/hover/atalhos permanecem acessíveis.
- [ ] QA em breakpoints pequenos para evitar quebra de linha.

### Iteração D — Metadados visíveis

- [x] Avaliar duas abordagens: (a) aumentar `minWidth` e permitir horizontal scroll controlado; (b) fornecer painel detalhado (modal/drawer).
- [x] Implementar opção escolhida + toggles para esconder/mostrar metadados avançados.
- [ ] Atualizar documentação (`docs/bets-grid-polish-plan.md`) com decisões finais.

### Iteração E — QA & Docs

- [ ] Rodar suite CLI e smoke da página de geração.
- [ ] Capturar screenshots modo claro/escuro (antes/depois) e anexar ao PR.
- [ ] Atualizar changelog/resumo para refletir melhorias de UI.

## Riscos & Mitigações

- **Sticky + ordenação**: revalidar sincronização com `React Data Grid` após ajustes de scroll.
- **Responsividade**: ampliar área pode causar overflow em mobile – usar media queries/Accordion.
- **A11y**: manter textos descritivos e foco visível em botões reposicionados.

## TODO Consolidado

- [x] Scroll ajustado.
- [x] Estratégia localizada.
- [x] Botão de cópia reposicionado.
- [x] Metadados com visualização expandida.
- [ ] QA + docs atualizados.
