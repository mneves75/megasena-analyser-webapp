# AGENTS.md

Guia público para agentes e contribuidores automáticos deste repositório.

## Escopo

- Assuma que este repositório é **público**.
- Nunca publique segredos, tokens, credenciais, caminhos locais, detalhes privados de SSH ou notas operacionais pessoais.
- Use placeholders públicos em exemplos (`user@server`, `example.com`, etc.).

## Stack

- Bun `>=1.3.14`
- Next.js `16.2.6`
- React `19.2.x`
- App Router + `output: standalone`

## Comandos obrigatórios antes de concluir mudanças

```bash
bun run lint
bun x tsc --noEmit
bun run test -- --run
bun audit
bun run build
bun run test:e2e
```

Para auditoria de histórico antes de releases sensíveis, rode também:

```bash
bun run security:secrets:history
```

Esse comando gera relatório redigido e deve falhar enquanto houver possíveis segredos em commits alcançáveis.

## Fluxo de produção local

```bash
bun run build
bun run start
```

## Verificação pós-deploy

Depois de atualizar o servidor público, execute:

```bash
bun run deploy:verify
```

Se `/api/health` retornar versão diferente de `package.json`, trate a release como não implantada.

## Fluxo de trabalho obrigatório

- **Verifique após cada mudança** com o agent-browser (skill `/browser` do gstack) e corrija qualquer problema de UI/UX. Não pare até que todas as mudanças tenham sido verificadas.
- **Relato de bug começa por um teste que falha.** Não tente corrigir antes; primeiro escreva um teste que reproduza exatamente o bug, depois delegue a subagentes a correção e prove com o teste passando. Sem teste, não há fix.
- **Encerre com a skill `autoreview`** e corrija tudo o que ela apontar.

## Regras de mudança

- Se comportamento público mudar, atualize `README.md`, `CHANGELOG.md` e `CLAUDE.md`.
- Mantenha docs coerentes com o runtime real; não documente comandos inexistentes.
- O baseline de Bun é 1.3.14; CI, Docker, `package.json` e docs devem permanecer alinhados.
- `bunfig.toml` habilita `run.noOrphans` para evitar processos Bun órfãos quando o processo pai morre.
- Preserve compatibilidade do App Router com o caminho suportado de CSP e hidratação em produção.
- `bun run build` deve falhar se `.next/standalone` contiver bancos SQLite, WAL/SHM, backups ou artefatos `.bak`; não publique output standalone bruto com estado local de banco.
- CSP de produção usa nonce por request para scripts e estilos; não troque para CSP estática/SRI sem prova E2E de hidratação e ausência de violações CSP no navegador.
- A exceção `style-src-attr 'unsafe-inline'` é permitida somente para atributos de estilo de bibliotecas de visualização; não adicione `unsafe-inline` a `script-src` ou `style-src`.
- Se `TRUST_PROXY_HEADERS=true`, liste peers não-loopback em `TRUSTED_PROXY_IPS`; não volte a confiar redes privadas inteiras sem ameaça/teste documentados.
- Bypass de rate limit interno exige `INTERNAL_API_SECRET` forte e peer loopback; nunca aceite apenas um header público como prova de chamada interna.
- Overrides de dependências em `package.json` são gates de segurança temporários; remova apenas quando `bun audit` continuar limpo sem eles.
- Não reintroduza scripts mortos, artefatos locais ou gates falsos no CI.
