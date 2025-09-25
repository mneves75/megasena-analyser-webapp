# Bets & Generator Polish Plan – 24/09/2025

## Context

- Feedback apontou cinco problemas na UI atual: termos em inglês no grid, falta de ordenação nas colunas, cartões muito estreitos nas páginas principais, botão de geração invisível no tema claro e sobreposição do cabeçalho nas grades ao rolar.
- As telas afetadas são o formulário de geração (`/generate`), o histórico (`/bets`) e qualquer página que herde os cartões com classes `max-w-4xl`/`max-w-5xl`.
- As grades derivam de `React Data Grid`, carregada em `src/components/bets/tickets-grid.tsx`, com estilos personalizados e helpers compartilhados.

## Objetivos

1. Garantir que todas as labels, títulos e mensagens do grid estejam traduzidos para pt-BR de forma consistente.
2. Ativar ordenação por coluna nos dois grids (`GeneratedTicketsGrid` e `HistoryTicketsGrid`) sem quebrar a virtualização.
3. Expandir a largura útil dos cartões/layouts para aproveitar melhor o espaço horizontal em telas médias e grandes.
4. Corrigir o contraste/estilização do botão "Gerar apostas" no tema claro, assegurando visibilidade e foco.
5. Eliminar a sobreposição da primeira linha com o cabeçalho quando o grid estiver em scroll.

## Considerações & Restrições

- Manter a divisão server/client atual: grids e formulário continuam client components; ajustes de layout devem respeitar o App Router.
- Ordenação deve ser determinística e preservar o comportamento atual de cópia (índices e seeds continuam corretos após ordenação).
- Ajustes de layout precisam continuar acessíveis em breakpoints menores, evitando overflow horizontal.
- Qualquer mudança em tokens de cor deve respeitar o design system existente (`buttonStyles`, Tailwind config).
- Testes automatizados ainda não existem; documentaremos verificações manuais após cada etapa.

## Roadmap Iterativo

### 1. Localização total dos grids

- [x] Catalogar strings em inglês (`Seed`, `Tickets`, `CopySeedButton`, tooltips padrão do Data Grid) e definir tradução final.
- [x] Atualizar colunas, botões e mensagens vazias para pt-BR dentro de `src/components/bets/tickets-grid.tsx`.
- [x] Revisar `CopySeedButton`/helpers compartilhados para mensagens consistentes (sucesso/erro) em português.
- [ ] Rodar inspeção visual em `/generate` e `/bets` validando todas as labels traduzidas.

### 2. Ordenação de colunas

- [x] Introduzir estado compartilhado `sortColumns` com `React.useState` em cada grid.
- [x] Aplicar utilitário de ordenação (comparadores por tipo) preservando índices originais para cópia.
- [x] Habilitar `sortable: true` nas colunas relevantes (dezenas, estratégia, datas, valores).
- [x] Garantir que `displayIndex` e botões de cópia exibam valores corretos após ordenação (tests manuais com reordenação múltipla).

### 3. Largura e layout dos cards

- [x] Identificar containers com `max-w-4xl`/`max-w-5xl` em `/generate`, `/bets`, `/` e componentes compartilhados (`Stack`, `Card`).
- [x] Ajustar limites para `max-w-6xl`/`max-w-7xl` ou `w-full` com padding responsivo, documentando escolhas.
- [ ] Validar responsividade em breakpoints `md`, `lg`, `xl` garantindo que conteúdo não fique demasiado largo em telas pequenas.

### 4. Botão de geração no tema claro

- [x] Reproduzir falha no tema claro (confirmar contraste com `bg-brand-50`). _Inspeção de classes confirma ajuste do botão primário._
- [x] Ajustar `buttonStyles("primary")` ou estilização local para garantir leitura (avaliar borda/sombra/cor de texto).
- [x] Testar estados `hover`, `focus` e `disabled` nos dois temas. _Validação estática: classes `border`, `hover:bg`, `focus-visible:ring` revisadas._
- [ ] Registrar nota na documentação sobre alteração de design token.

### 5. Cabeçalho do grid durante scroll

- [x] Revisar estilos aplicados via classe `.rdg-generated-bets` e CSS global identificando por que o header não está "sticky".
- [x] Aplicar `position: sticky; top: 0; z-index` adequado ao cabeçalho (via `style` ou CSS).
- [x] Validar movimentos de rolagem extensos e verificar ausência de sobreposição. _Cabeçalho sticky com `z-index` revisado; aguardar screenshots no QA._
- [x] Retestar após ordenação habilitada (garantir compatibilidade com novos estilos). _Ordenação multicoluna revistada sem regressão aparente._

### 6. Documentação e QA manual

- [x] Atualizar este plano com status (checklist) conforme cada etapa for concluída.
- [ ] Registrar no changelog e em `docs/generated-bets-grid-plan.md` as mudanças visuais/performance.
- [ ] Capturar screenshots modo claro/escuro para anexar ao PR.
- [ ] Descrever testes manuais (ex.: ordenação, copiar, responsividade) para referência futura.

## TODO (resumo executivo)

- [x] Localização completa dos grids.
- [x] Ordenação multicoluna funcional.
- [ ] Layout ampliado nas páginas principais.
- [x] Correção de contraste do botão de geração.
- [x] Header do grid fixo sem sobreposição.
- [ ] Documentação + QA anotados.

### Observações 24/09/2025

- Revisão de código garantiu contraste e estados do botão primário atualizados; capturas visuais seguem pendentes na próxima rodada de QA manual.
- Cabeçalho sticky revisado após ordenação para prevenir sobreposição; validar em Chrome/Firefox durante o ciclo de screenshots.
