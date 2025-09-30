# Tokens de Design – Mega-Sena Analyzer

Documente estes tokens em cada nova tela. Eles servem como referência para manter a identidade premium definida no prompt.

## Cores Base

- **Fundo Neutro Claro (`surface.DEFAULT`)**: `#f5f6f8` – preenchimento padrão de páginas e cartões claros.
- **Fundo Neutro Escuro (`surface.dark`)**: `#0f1014` – base do modo escuro.
- **Texto Primário (`--foreground`)**: `#111827` (claro) / `#e5e7eb` (escuro).
- **Brand Azul (`brand.500`)**: `#2f7bff`; utilizar para CTAs e estados ativos.
- **Brand Azul Profundo (`brand.600`)**: `#1f5fe6`; utilizar em hover/foco.
- **Gradiente Aurora**: radial de `brand.500` para transparente (usado no fundo da AppShell).

## Tipografia

- **Fonte**: Inter (`--font-inter` via `next/font`).
- **Tracking padrão**: `-0.02em`; títulos grandes podem usar `-0.05em` (`tracking-tightest`).
- **Escala sugerida**: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-2xl`, `text-4xl`, `text-5xl` para hero.

## Espaçamento e Raio

- **Raio padrão**: `rounded-lg` = `16px`.
- **Raio destaque**: `rounded-2xl` = `32px` (cartões principais, shells).
- **Padding de cartão**: `p-6` para blocos médios; `p-10` para heros.
- **Gap padrão**: `gap-6` para grids, `gap-4` para conteúdo interno.

## Sombras e Vidro

- **`shadow-soft`**: `0 10px 30px rgba(15, 23, 42, 0.08)` – botões principais.
- **`shadow-card`**: `0 18px 40px rgba(15, 23, 42, 0.06)` – cartões e modais.
- Use `backdrop-blur-md` + `bg-white/60` para efeito vidro em layouts claros.

## Botões

- **Primário**: `bg-brand-500`, texto branco, ripple claro, hover `bg-brand-600`.
- **Secundário**: `bg-white/85`, contorno `border-black/5`, texto escuro; no dark mode `bg-white/10`, texto claro.
- **Ghost**: `bg-transparent`, realce `hover:bg-black/5` (claro) ou `hover:bg-white/10` (escuro).
- Ripple animado com `animate-ripple` (650ms) mantendo suavidade.

## Microinterações

- Transições rápidas (`duration-200`) em links, botões e navegação.
- Navegação com realce ativo `bg-slate-900 text-white` e hover suave.
- Utilizar `scroll-behavior: smooth` e seletores `::selection` customizados (azul brand semi-transparente).

## Aplicação

- Favor reutilizar `buttonStyles` (arquivo `src/components/ui/button-variants.ts`) para links estilo botão.
- Cartões devem aplicar `data-card` ou seguir o padrão `Card` (`src/components/ui/card.tsx`).
- Atualize este documento ao ajustar tokens ou introduzir novos componentes base.
