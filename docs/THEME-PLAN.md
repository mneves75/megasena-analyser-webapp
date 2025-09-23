## Plano de Tema (Light/Dark) · Mega-Sena Analyzer

### Objetivo

Melhorar legibilidade e contraste no modo claro e habilitar modo escuro com comutador persistente, seguindo App Router + RSC.

### Diretrizes

- Server por padrão; `"use client"` apenas para o Toggle.
- `darkMode: "class"` (já configurado no Tailwind). Class `dark` aplicada em `<html>`.
- Variáveis CSS em `globals.css` são a fonte de verdade para fundo/superfícies/foreground.
- `next/script` com `beforeInteractive` para inicializar tema antes da pintura (evita FOUC).

### Paleta proposta

Light (RGB tokens em `:root`):

- `--background`: `250 250 252` (quase branco com toque frio)
- `--foreground`: `17 24 39` (Slate-900)
- `--surface-muted`: `255 255 255`
- `--surface-elevated`: `244 247 252` (equilíbrio de contraste sobre background)
- `--brand-500`: `47 123 255` (coerente com escala Tailwind `brand.500`)
- `--brand-600`: `31 95 230`

Dark (`.dark`):

- `--background`: `15 16 20`
- `--foreground`: `229 231 235`
- `--surface-muted`: `24 27 33`
- `--surface-elevated`: `19 21 26`
- `--brand-500`: `86 148 255`
- `--brand-600`: `47 123 255`

Escala `brand` no Tailwind permanece; botões/links usam `brand-500/600`.

### Mudanças técnicas

1. Atualizar variáveis light em `src/app/globals.css` para nova paleta
2. Inserir Script de inicialização de tema em `src/app/layout.tsx` (antes da hidratação)
3. Criar `ThemeToggle` cliente em `src/components/layout/theme-toggle.tsx` (localStorage + class `dark`)
4. Integrar `ThemeToggle` no cabeçalho do `AppShell`

### TODO

- [ ] Refinar paleta clara em `globals.css`
- [ ] Adicionar Script de init de tema (`beforeInteractive`)
- [ ] Criar `ThemeToggle` com persistência
- [ ] Integrar Toggle no `AppShell`
- [ ] Rodar lint/typecheck/build

### Critérios de aceite

- Tema claro com melhor contraste percebido (texto legível sobre cartões e fundo)
- Alternância entre claro/escuro sem flash perceptível
- Preferência persiste após reload
- Lint/typecheck/build sem alertas/erros

### Riscos/Notas

- Evitar `any` em TS; manter ações no cliente restritas ao Toggle
- Se no futuro houver SSR por cookie, mover lógica de leitura para server
