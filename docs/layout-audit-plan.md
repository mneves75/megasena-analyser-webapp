# Plano de Auditoria de Layout

> Atualizado em 24/09/2025 – acompanha o Stage 6 da UI.

## Referências de Ferramentas

- `Page.captureScreenshot`, `Page.setDeviceMetricsOverride` e `Emulation.setEmulatedMedia` permitem capturar estados light/dark e breakpoints mobile/desktop sem depender de extensões externas.citeturn8view0
- `Overlay.highlightFrame`, `DOM.getContentQuads` e `CSS.getComputedStyleForNode` ajudam a identificar caixas que provocam overflow, desalinhamentos e contrastes inconsistentes.citeturn8view0

## Escopo Inicial

- Shell (header/footer) renderizado por `src/components/layout/app-shell.tsx`.
- Landing/Home (`src/app/page.tsx`).
- Estatísticas (`src/app/stats/page.tsx`).
- Gerador de apostas (`src/app/generate/page.tsx` + `BetGeneratorForm`).
- Histórico (`src/app/bets/page.tsx`).

## Todo & Sequenciamento

- [x] Levantar comandos relevantes no Chrome DevTools MCP e escopo das rotas-chave.
- [ ] Rodar `npm run dev` com banco semeado e conectar DevTools MCP para registrar screenshots 1440px/375px em light/dark.
- [ ] Executar rotina de overflow: `Page.setDeviceMetricsOverride` → `Overlay.highlightFrame` nos elementos `html`, `body`, `main`, `header` para detectar scroll horizontal indesejado.
- [ ] Auditar navegação (`Navigation`) em <= 360px usando `DOM.querySelector` e `CSS.getComputedStyleForNode` para confirmar quebra de layout e decidir por `flex-wrap` automático.
- [ ] Validar cartas do `StatsDashboard`: usar `Overlay.highlightNode` nas grids e `Layout.getLayoutTreeAndStyles` para garantir espaçamentos mínimos (>=16px) e verificar altura dinâmica dos gráficos.
- [ ] Verificar formulário do gerador: confirmar largura mínima do bloco `Card` e comportamento do CTA gradiente em telas < 768px; capturar warnings de contraste caso surjam.
- [ ] Revisar histórico: testar filtros simultâneos, checar quebra das tags `EmptyState` e grid de tickets; medir performance de `HistoryTicketsGrid` (paint/hidratação) via `Tracing.start` se necessário.
- [ ] Consolidar achados em checklist com severidade (Alta/Média/Baixa) e anexar sugestões de correção.
- [ ] Atualizar README com capturas light/dark após execução completa do backlog visual.

## Procedimento MCP recomendado

1. **Set up da sessão**
   - `npm run dev` com `npm run db:seed` antes de conectar.
   - Abrir o MCP `chrome-devtools` via `list_pages` e `select_page` para focar a aba correta.
   - Disparar `take_snapshot` e exportar o mapa inicial de elementos para referenciar `uid` nas inspeções.
2. **Captura de baseline**
   - Usar `resize_page` duas vezes (1440x900 e 375x812) para fixar os breakpoints principais.
   - Ativar `take_screenshot` com `fullPage=true` em cada rota (Home, Stats, Generate, Bets) salvando light/dark.
   - Habilitar o Protocol Monitor para registrar todos os comandos emitidos e anexar o log bruto na pasta `docs/observability/`.
3. **Rotina anti-overflow**
   - Em viewports ≤ 360 px, executar `evaluate_script` para ler `document.scrollingElement.scrollWidth` e comparar com `innerWidth`.
   - Acionar `Overlay.highlightNode` em `html`, `body`, `main` e `header` para visualizar caixas que escapem da viewport.
   - Se algum valor exceder, registrar `DOM.getContentQuads`/`Overlay.highlightQuad` no log para localizar offsets.
4. **Audições por feature**
   - `Navigation`: `resize_page` → `take_snapshot` → conferir `basis-[45%]` via `CSS.getComputedStyleForNode` e validar espaçamento residual.
   - `StatsDashboard`: usar `Overlay.setShowGridOverlays` e `evaluate_script` para garantir `gap >= 16` e ausência de merge de colunas.
   - `BetGeneratorForm`: capturar `take_screenshot` parcial do CTA e usar `evaluate_script` para verificar `cta.offsetWidth >= 280`.
   - `HistoryTicketsGrid`: rodar `performance_start_trace` por 5s com filtros de `hyd`/`paint` para detectar travamentos. Encerrar com `performance_stop_trace` e salvá-lo em `docs/perf/`.
5. **Relato e follow-up**
   - Classificar severidade (Alta/Média/Baixa) e status (Aberto/Em progresso/Resolvido) no quadro de checklist.
   - Quando um item for resolvido, anexar ID do commit ou PR e reexecutar `take_screenshot` correspondente.

## Iteração 1 – 24/09/2025

- Revisão estática de `AppShell` indica dois riscos de overflow horizontal: `BackgroundAura` usa offsets ±20% sem `overflow-hidden`, e a navegação em pílulas não possui `flex-wrap`, o que pode extrapolar a largura em telas pequenas.
- Próximos passos: confirmar no navegador reduzindo viewport para 320px (`Page.setDeviceMetricsOverride`) e capturando `DOM.getContentQuads` de `body` e `nav` para validar o transbordo; aplicar `flex-wrap` ou mover aura para pseudo-elemento com máscara.

## Iteração 2 – 24/09/2025

- Aplicado `overflow-hidden` no contêiner raiz de `AppShell` para conter os gradientes de `BackgroundAura` sem remover o efeito visual.
- Atualizada a navegação para permitir `flex-wrap` e distribuir links em duas linhas em viewports ≤ 360px, adicionando base flexível às âncoras.
- Pendente: reexecutar checklist de overflow após build (`Page.setDeviceMetricsOverride` + `Overlay.highlightFrame`) para confirmar eliminação do scroll horizontal.

## Iteração 3 – 24/09/2025

- Mapeado fluxo MCP end-to-end (setup → captura → overflow → feature) para padronizar auditoria independente do viewport.
- Definido uso de `resize_page` e `take_screenshot` como baseline obrigatório em todas as rotas, garantindo material para atualizar o README ao fim do backlog visual.
- Agendado re-run pós-`npm run build` com `performance_start_trace` na página de histórico para medir latência de hidratação antes e depois da correção de overflow.

## Evidências & Capturas Pendentes

- Adicionar galeria de prints (light/dark) para Home, Stats, Generate e Bets quando o backlog visual estiver concluído.
- Registrar gifs curtos das interações do formulário e do histórico paginado assim que os dados reais estiverem disponíveis.
