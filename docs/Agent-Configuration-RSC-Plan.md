# Plano de Revisão — Agent Configuration RSC

## Objetivo

Corrigir problemas de clareza, formatação e abrangência do documento `Agent Configuration React Server Comp.md`, alinhando-o às práticas atuais de React Server Components (RSC) e do stack do projeto.

## Diagnóstico Inicial

- Seção de diretrizes `useEffect` contém texto corrompido, links quebrados e aspas inconsistentes.
- Falta de orientação específica para uso no contexto Next.js 15 / App Router (carregamento de dados, server actions com formulários, streaming).
- Diretrizes finais sobre `hono / drizzle` pouco conectadas ao restante do texto e sem relação direta com o projeto.
- Documento não aborda armadilhas comuns (serialização, compartilhamento de módulos, cache, error handling).
- Necessário reforçar padrões de organização de arquivos (co-location, nomeação) e integração com tooling existente no repositório.

## Plano Iterativo

1. **Higienização & Estrutura**
   - Corrigir títulos, links, aspas e formatação quebrada.
   - Revisar linguagem para português claro e consistente.
   - Organizar seções com hierarquia linear (Persona → Filosofia → use client → use server → Padrões RSC → Anti-patterns → Checklist).
2. **Atualização Técnica**
   - Incluir melhores práticas para Server Components em Next.js 15 (streaming, data fetching, cache, suspense).
   - Adicionar exemplos de server actions usando formulários e mutações idempotentes.
   - Cobrir serialização segura, separação de módulos server/client, e reutilização de lógica.
3. **Contexto do Projeto**
   - Relacionar recomendações à stack (Prisma/SQLite, análises estatísticas, Tailwind/shadcn).
   - Remover ou mover conteúdo sobre hono/drizzle para seção “Extras” ou docs específicos.
   - Acrescentar checklist final para agentes verificarem antes de enviar código.

## TODO

- [x] Reescrever seção `React useEffect Guidelines` com link correto e bullets claros.
- [x] Acrescentar subseção “Padrões recomendados no Next.js App Router”.
- [x] Inserir notas sobre serialização e cache (ex.: `cache()`, `revalidatePath`).
- [x] Atualizar exemplos de código para TypeScript e diretórios `app/`.
- [x] Criar checklist final (“Antes de entregar”).
- [x] Validar links e formatar markdown final.
