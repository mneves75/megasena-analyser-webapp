# Segurança

## CSP em produção

O projeto usa CSP nonce-based em `proxy.ts` e `lib/security/csp.ts`.

- `script-src` de produção usa `nonce` + `strict-dynamic` e não usa `unsafe-inline`.
- `style-src` de produção usa o mesmo `nonce`, não usa `unsafe-inline` e permite `https://fonts.googleapis.com`. A exceção estreita `style-src-attr 'unsafe-inline'` é mantida somente para atributos `style` gerados por bibliotecas de visualização.
- `proxy.ts` não emite `upgrade-insecure-requests` nem HSTS, porque o standalone do Next pode derivar `request.url` de headers encaminhados antes do middleware validar o peer; aplique HSTS no reverse proxy que termina TLS.
- JSON-LD deve passar pelos componentes em `components/seo/json-ld.tsx`, que aplicam nonce e escapam `<`.

### Verificação de CSP na borda

Depois de deploys ou mudanças em Cloudflare/Traefik, rode:

```bash
bun run security:csp:edge
```

O comando busca a home pública e `/api/health`, compara os headers com o contrato do app e falha quando:

- `script-src` ou `style-src` públicos perdem o nonce por request;
- `script-src` público volta a aceitar `unsafe-inline` ou `unsafe-eval`;
- `/api/health` deixa de retornar a CSP deny-by-default da API Bun;
- a borda expõe headers externos/obsoletos que indicam middleware de headers fora do app.

Se o comando falhar enquanto o HTML ainda mostra `Link` com `nonce=`, a aplicação gerou o nonce e a CSP foi substituída depois dela. Verifique, nessa ordem:

1. Cloudflare Response Header Transform Rules com operação `Set static`/`Set dynamic` em `Content-Security-Policy`;
2. Cloudflare Client-side security/Page Shield em modo `Allow`, que adiciona CSP de bloqueio e não suporta nonce;
3. Snippets/Workers que definam headers de segurança;
4. middleware de headers do Traefik/Nginx/reverse proxy, que deve emitir HSTS mas não deve definir CSP.

Se a mesma CSP ampla aparece em HTML e `/api/health`, priorize uma regra compartilhada de response headers na borda/proxy. Page Shield/Client-side security é uma hipótese mais fraca nesse padrão porque também houve substituição da CSP deny-by-default da API JSON. Se o HTML contém `__CF$cv$params` ou `/cdn-cgi/challenge-platform/scripts/jsd`, Cloudflare JavaScript Detections está ativo; remova primeiro a regra que substitui a CSP e valide se o Cloudflare passa a preservar/propagar os nonces da aplicação.

Quando a mesma CSP não-app aparece na home e na API, o verificador imprime um fingerprint curto (`sha256:<16 hex>`), as diretivas/fontes suspeitas, o dono provável da sobrescrita e ações de remediação públicas. `shared_response_headers` é o diagnóstico esperado para CSP idêntica em HTML e API com nonce ainda presente no HTML; nesse caso, compare o fingerprint com Response Header Transform Rules ou middleware de headers do proxy antes de investigar Page Shield. O fingerprint não substitui o Trace nem autoriza publicar IDs de regras, hosts, caminhos reais, contas ou detalhes privados do deploy.

Se houver uma URL de origem direta fora da borda pública, defina `ORIGIN_BASE_URL` apenas no ambiente local/operacional:

```bash
ORIGIN_BASE_URL=https://origin.example.com bun run security:csp:edge
```

O comando compara home e `/api/health` da origem direta com a borda pública, mas não imprime a URL de origem. Se a origem direta mantiver a CSP nonce-based e a API deny-by-default enquanto a borda pública falha, a substituição acontece depois da aplicação; priorize Cloudflare/Traefik. Nunca coloque hosts, IPs, caminhos reais ou URLs privadas em `.env.example`, commits, issues ou logs públicos.

Se houver token Cloudflare com acesso read-only à zona, o mesmo comando também lista Response Header Transform Rules e políticas Client-side security/Page Shield candidatas:

```bash
CLOUDFLARE_API_TOKEN=<token-redigido> CLOUDFLARE_ZONE_NAME=megasena-analyzer.com.br bun run security:csp:edge
```

O token não é impresso. Use `CLOUDFLARE_ZONE_ID` no lugar de `CLOUDFLARE_ZONE_NAME` quando já souber o ID da zona.
O resultado diferencia três estados: zona inacessível ao token, falha parcial de leitura de Rulesets/Page Shield e zona acessível sem regra candidata. Só trate "sem regras candidatas" como evidência depois que o comando confirmar que a zona foi resolvida.

Para atribuir a regra ativa com Cloudflare Trace, use também `CLOUDFLARE_ACCOUNT_ID`. O token precisa da permissão read-only `Allow Request Tracer Read`; o comando envia `GET` para `CLOUDFLARE_TRACE_URL` ou para a home pública por padrão e imprime apenas nomes/descrições de passos matched que citam CSP:

```bash
CLOUDFLARE_API_TOKEN=<token-redigido> CLOUDFLARE_ACCOUNT_ID=<account-id-redigido> bun run security:csp:edge
```

Se Trace não listar nenhum passo CSP, volte para Rulesets/Page Shield e reverse proxy; Trace depende do account correto e de uma URL pertencente a esse account.
Use `CLOUDFLARE_TRACE_HEADERS_JSON` apenas com headers públicos de simulação, como `User-Agent`; não coloque cookies, bearer tokens ou segredos nesse JSON. `CLOUDFLARE_TRACE_SKIP_RESPONSE=true` e `CLOUDFLARE_TRACE_SKIP_CHALLENGE=true` são opt-ins para reproduzir avaliação de regras sem mudar configuração remota.

### Decisão sobre nonce vs CSP estática/SRI

Em 2026-05-14 foi testada a alternativa com CSP estática e SRI do Next.js.

Resultado observado:

| Variante         | Cache da home                                                   | Hidratação                                                                                         | Decisão   |
| ---------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------- |
| CSP estática/SRI | `s-maxage=31536000`, `x-nextjs-prerender: 1`                    | Falha; a página fica no estado "Carregando aplicação" por bloqueio de scripts inline do App Router | Rejeitada |
| CSP nonce-based  | `private, no-cache, no-store` para páginas protegidas por nonce | Funciona sem violações CSP no navegador                                                            | Mantida   |

A perda de cache estático é aceita porque a alternativa estrita quebra a aplicação com o runtime atual do App Router. Reavalie esta decisão somente quando o Next.js suportar este fluxo sem scripts inline de streaming, ou quando houver um teste E2E que prove hidratação completa sem `unsafe-inline`.

## Headers da API Bun

A superfície `/api/*` roda em `server.ts` fora do servidor Next.js. Por isso ela não deve depender apenas do `proxy.ts` para headers defensivos.

Todas as respostas da API Bun passam por `buildApiSecurityHeaders()` e devem manter:

- CSP deny-by-default para respostas JSON: `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- COOP/CORP restritivos
- HSTS somente em produção quando a requisição chega como HTTPS

O CORS público permanece baseado em allowlist de origem. Como a API não usa autenticação via `Authorization`, o preflight deve aceitar apenas `Content-Type` até existir uma necessidade real e testada de ampliar essa superfície. Preflights em `/api/*` também consomem o orçamento de rate limit para evitar abuso de `OPTIONS`.

Endpoints JSON mutáveis rejeitam `Content-Type` ausente ou não JSON com `415`, reduzindo abuso por requisições simples cross-site que não passam por preflight CORS.

Todos os endpoints públicos devem declarar e respeitar métodos HTTP permitidos. Métodos não suportados retornam `405` com header `Allow` antes de executar handlers analíticos. O rate limit de 100 requisições/minuto por identificador de cliente cobre toda a superfície `/api/*`, incluindo `/api/health` e preflights CORS.

## Logs e auditoria

Metadados operacionais de logs e auditoria usam sanitização recursiva compartilhada antes de saída/persistência. O helper redige chaves sensíveis aninhadas, limita profundidade, limita arrays e trata ciclos para evitar vazamento acidental ou payloads excessivos.

## Confiança em proxy

`TRUST_PROXY_HEADERS=true` permite usar `CF-Connecting-IP`, `X-Real-IP` ou `X-Forwarded-For` para rate limiting/auditoria, mas somente quando o peer do socket é loopback ou está explicitamente listado em `TRUSTED_PROXY_IPS`, e o valor encaminhado é um IP válido. A precedência privilegia headers normalmente sobrescritos pelo edge (`CF-Connecting-IP`, depois `X-Real-IP`) antes de cair para `X-Forwarded-For`. O proxy reverso deve remover ou sobrescrever headers de IP recebidos do cliente; não preserve cadeias arbitrárias de `X-Forwarded-For`. Na API Bun, `X-Forwarded-Proto` segue o mesmo limite para cálculo de requisição segura/HSTS. No `proxy.ts` do Next, HSTS e `upgrade-insecure-requests` não são emitidos porque o middleware não valida o peer de socket e o standalone pode derivar `request.url` de headers encaminhados. HSTS para TLS terminado deve ser aplicado no reverse proxy. Se a API Bun for exposta diretamente à internet, headers de proxy enviados pelo cliente são ignorados.

Chamadas server-side internas podem definir `INTERNAL_API_SECRET` (mínimo de 32 caracteres) para não consumir a cota pública de `/api/*`. O bypass só é aceito quando o peer é loopback e o segredo compartilhado bate em comparação constante; headers enviados por clientes públicos não são suficientes.

## Secret scanning

O repositório não mantém baseline de segredos rastreado em Git. O CI executa `bun run security:secrets`, que copia apenas arquivos fonte rastreados/não ignorados para um diretório temporário e roda `gitleaks dir` com a imagem `ghcr.io/gitleaks/gitleaks:v8.30.1`.

Para validar o histórico Git completo, rode `bun run security:secrets:history`. Esse comando usa `gitleaks detect --redact`, grava o relatório redigido em `.tmp/gitleaks-history-redacted.json`, resume regras/arquivos afetados e classifica quais branches/tags ainda alcançam cada commit com achados. O comando falha quando encontra achados. Não publique o relatório bruto em issues, PRs ou documentação.

Varreduras de histórico com `gitleaks detect` podem apontar commits antigos. Se um achado histórico for confirmado como segredo real, faça rotação da credencial antes de qualquer limpeza de histórico.

### Runbook para achados históricos

Use este fluxo antes de qualquer rewrite de histórico:

1. Gere relatório redigido:
   ```bash
   bun run security:secrets:history
   ```
2. Use o campo `reachability` do resumo para separar achados alcançáveis por `main`/tags públicas daqueles limitados a branches locais.
3. Classifique cada arquivo/regra sem expor valores de segredo em issue, PR ou documentação pública:
   - **Crítico**: commit alcançável por branch remota ou tag pública e regra compatível com credencial real.
   - **Alto**: commit alcançável apenas por tag antiga ou branch local compartilhada.
   - **Médio**: falso positivo provável, mas com formato de credencial suficiente para exigir confirmação do dono do serviço.
4. Para qualquer segredo real, crie credencial nova primeiro, atualize o serviço consumidor e teste o novo acesso.
5. Revogue a credencial antiga somente depois que o novo acesso estiver funcionando.
6. Só então planeje limpeza de histórico com janela de coordenação, porque `git filter-repo`/BFG exige force-push e re-clone/rebase de clones existentes.
7. Antes do rewrite, registre publicamente apenas metadados seguros: regras afetadas, nomes de arquivos, commits abreviados, branches/tags alcançáveis e decisão de rotação. Nunca registre valores, hashes integrais de segredo, URLs autenticadas ou headers de autorização.
8. Em rewrite de histórico, trate tags públicas como parte do escopo. Um commit removido de `main` mas ainda alcançável por tag continua exposto.
9. Depois do rewrite, valide:
   ```bash
   bun run security:secrets:history
   bun run security:secrets
   ```
10. Confirme que `git branch -r --contains <commit>` e `git tag --contains <commit>` não retornam refs públicas para commits removidos.
11. Publique aviso de manutenção para consumidores do repositório pedindo re-clone ou rebase a partir do novo histórico. Não preserve refs antigas no remoto.

Não execute rewrite de histórico enquanto a rotação da credencial não estiver concluída. Rewrite reduz exposição futura, mas não revoga uma credencial já publicada.

## Overrides de dependências

Os overrides em `pnpm-workspace.yaml` (chave `overrides`) existem para manter `pnpm audit` limpo contra vulnerabilidades transitivas enquanto os pacotes ascendentes ainda não resolvem versões seguras. O campo `overrides` top-level do `package.json` (formato npm/Bun) é ignorado silenciosamente pelo pnpm — nunca declare pins lá.

Overrides atuais de segurança:

- `@babel/core`
- `brace-expansion`
- `flatted`
- `js-yaml`
- `picomatch`
- `postcss`
- `ws`

Remova um override apenas quando:

1. o pacote ascendente resolver versão segura sem override;
2. `pnpm install` atualizar o `pnpm-lock.yaml` sem reintroduzir a versão vulnerável;
3. `pnpm audit` continuar retornando `No known vulnerabilities found`;
4. `bun run lint`, `bun x tsc --noEmit`, `bun run test -- --run`, `bun run build` e `bun run test:e2e` passarem.
