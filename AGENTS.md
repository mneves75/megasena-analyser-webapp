# AGENTS.md

Guia público para agentes e contribuidores automáticos deste repositório.

## Escopo

- Assuma que este repositório é **público**.
- Nunca publique segredos, tokens, credenciais, caminhos locais, detalhes privados de SSH ou notas operacionais pessoais.
- Use placeholders públicos em exemplos (`user@server`, `example.com`, etc.).

## Stack

- Bun `>=1.3.10`
- Next.js `16.2.x`
- React `19.2.x`
- App Router + `output: standalone`

## Comandos obrigatórios antes de concluir mudanças

```bash
bun run lint
bun x tsc --noEmit
bun run test -- --run
bun run build
bun run test:e2e
```

## Fluxo de produção local

```bash
bun run build
bun run start
```

## Regras de mudança

- Se comportamento público mudar, atualize `README.md`, `CHANGELOG.md` e `CLAUDE.md`.
- Mantenha docs coerentes com o runtime real; não documente comandos inexistentes.
- Preserve compatibilidade do App Router com o caminho suportado de CSP e hidratação em produção.
- Não reintroduza scripts mortos, artefatos locais ou gates falsos no CI.
