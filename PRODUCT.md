# Product

## Register

product

## Users

Apostadores recreativos brasileiros e curiosos por estatística que querem explorar o histórico completo da Mega-Sena (3.000+ concursos, dados oficiais CAIXA) e gerar apostas dentro de um orçamento. Usam em desktop e mobile, sessões curtas e orientadas a tarefa: conferir o último sorteio, explorar frequências, gerar um conjunto de apostas.

## Product Purpose

Ferramenta gratuita de análise estatística e geração de apostas da Mega-Sena. Diferencial: dados oficiais completos, análises honestas (sem promessa de previsão) e um gerador que otimiza alocação de orçamento via programação dinâmica. Sucesso = usuário confia nos números, entende os padrões históricos e gera apostas sem fricção.

## Brand Personality

Precisa, honesta, calma. "Cientista de dados, não vendedor de milagre". A identidade visual é teal sóbrio sobre neutros frios, com as bolas de loteria como assinatura visual. Tom pt-BR direto, sem hype.

## Anti-references

- Sites de "palpites de loteria" com promessas de ganho, cores berrantes, urgência artificial.
- SaaS-slop: grids de cards idênticos, gradient text, glassmorphism decorativo, hero-metric template.
- Cassino/apostas: dourado, vermelho, fogos, contadores piscando.

## Design Principles

1. **Dados na frente** — números reais (último concurso, frequências) aparecem antes de qualquer texto promocional. Show, don't tell.
2. **Honestidade estatística visível** — avisos de aleatoriedade são parte do design, compactos e consistentes, nunca escondidos nem gritados.
3. **Familiaridade ganha** — padrões de navegação e componentes padrão (registro product); a ferramenta desaparece na tarefa.
4. **Densidade legível** — números tabulares, hierarquia clara entre KPI primário e detalhe; denso onde o usuário compara, arejado onde ele lê.
5. **Movimento com propósito** — micro-interações via tokens CSS (ease-out-quint), 150–250ms, sempre com fallback reduced-motion.

## Accessibility & Inclusion

WCAG AA: contraste ≥4.5:1 em texto de corpo, foco visível em tudo que é interativo, reduced-motion respeitado globalmente (já implementado em globals.css), HTML lang pt-BR, navegação por teclado no gerador e nos accordions.
