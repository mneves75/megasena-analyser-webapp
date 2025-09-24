# Generated Bets Grid Plan — 24/09/2025

## Context

- Revisão "fresh eyes" identificou que o `BetGeneratorForm` apresenta as dezenas apenas em chips (`TicketBadges`), dificultando copiar o conteúdo para colar em planilhas ou no app oficial.
- O highlight "Soma média (janela 200)" exibe `0` quando não há concursos processados, mas a descrição já informa "Sem dados suficientes", gerando ruído visual.
- Usuário pediu grade de apostas fácil de ler/copiar e documentação enxuta antes da implementação.

## Objetivos

- Renderizar todas as apostas geradas em uma grade/tabulação com texto selecionável e botões de cópia.
- Facilitar a exportação manual adicionando ação de copiar todo o lote.
- Ajustar o card da Home para exibir placeholder amigável quando não houver dados para a média da soma.

## Escopo e entregáveis

1. **Grade copiable no gerador** — substituir o bloco atual de cards individuais por tabela responsiva utilizando `react-data-grid`, mantendo metadados acessíveis via `<details>`.
2. **Ação de copiar** — botão para copiar dezenas de cada ticket (formato `01 02 03 04 05 06`) e botão extra para copiar todas as combinações de uma vez.
3. **Fallback da soma média** — quando `sums.average` estiver vazio/NaN, exibir `—` como valor e manter mensagem de "Sem dados suficientes".
4. **Documentação** — atualizar este plano e registrar pendências/resultados após implementação.

## Todo

- [x] Implementar componente/tabulação para renderizar apostas em grade copiable.
- [x] Acrescentar botões de cópia individual e global no resultado da geração.
- [x] Tratar ausência de dados na highlight "Soma média".
- [x] Revisar código atualizado, rodar lint/cheques rápidos e registrar observações finais aqui.

## Notas de risco

- Necessário garantir que a grade continue responsiva em mobile (talvez colapso para stack vertical).
- Botões de cópia dependem da API Clipboard; precisamos fallback discreto para ambientes sem suporte (graceful degradation).
- Manter deduplicação de tickets e legibilidade mesmo com lotes grandes (até limite atual de estratégias).

## Resultados — 24/09/2025

- Grade tabular responsiva criada com `react-data-grid` (`TicketsGrid`) e ações de cópia por linha.
- Ação "Copiar todas" adicionada e com aviso degradável quando Clipboard API falhar.
- Highlight "Soma média" agora exibe `—` quando não há dados, mantendo descrição "Sem dados suficientes".
- `npm run lint` executado com sucesso após ajustes incrementais.
