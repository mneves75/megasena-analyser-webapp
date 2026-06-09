# Guia de Deploy

O Mega-Sena Analyzer roda em VPS com Docker, Traefik e Cloudflare, usando:

- frontend Next.js em `output: 'standalone'`
- superfície `/api/*` em `server.ts`, executada com Bun
- build local e imagem Docker apenas de runtime

## Arquitetura

```text
Usuário -> Cloudflare -> Traefik v3 -> contêiner Docker
                                       ├── Next.js standalone (porta 80)
                                       └── API Bun (porta 3201)
```

## Domínios

| Domínio                    | Papel                                   |
| -------------------------- | --------------------------------------- |
| `megasena-analyzer.com.br` | Primário                                |
| `megasena-analyzer.com`    | Redireciona 301 para `.com.br`          |
| `megasena-analyzer.online` | Redireciona 301 para `.com.br`          |
| `www.*`                    | Redireciona 301 para o domínio primário |

Os redirects ficam no arquivo dinâmico do Traefik (`megasena-analyzer.yaml`) no ambiente de deploy.

## Pré-requisitos

- Bun `>= 1.3.14` na máquina que gera o build
- Docker no servidor
- Acesso SSH gerenciado fora do repositório

## Staging

Este repositório não possui workflow automático de staging nem endpoint de staging público versionado. Um deploy de staging só deve ser declarado concluído quando houver um alvo explícito e alcançável fora do repositório, por exemplo:

- host SSH ou contexto Docker remoto dedicado a staging;
- diretório de compose de staging separado do ambiente de produção;
- domínio/base URL de staging para health check;
- segredo `IP_HASH_SECRET` real configurado no ambiente remoto;
- `TRUSTED_PROXY_IPS` definido quando `TRUST_PROXY_HEADERS=true` e o peer da API não for loopback;
- `INTERNAL_API_SECRET` forte se chamadas server-side internas precisarem escapar da cota pública de rate limit.

Não reutilize o alvo de produção como staging por inferência. Se o SSH ou o alvo remoto não estiver disponível, limite a entrega a preparar e validar o artefato local:

```bash
bun install --frozen-lockfile
bun run lint
bun x tsc --noEmit
bun run test -- --run
bun audit
bun run build
bun run test:e2e
bun run dist:standalone
COPYFILE_DISABLE=1 tar czf /tmp/megasena-staging-deploy.tar.gz --no-mac-metadata \
  dist/standalone/ public/ server.ts lib/ package.json bun.lock bunfig.toml tsconfig.json \
  scripts/start-docker.ts scripts/check-production-freshness.ts scripts/check-edge-csp.ts db/migrations/ Dockerfile
docker build -t megasena-analyser-app:staging-local .
```

Depois de subir em um staging real, valide com o domínio de staging usando `PRODUCTION_BASE_URL=https://staging.example.com bun run security:csp:edge` e um health check equivalente ao `deploy:verify` apontado para o mesmo ambiente. Não publique usuários, hosts, IPs, caminhos reais ou segredos em commits, issues ou logs públicos.

## Fluxo de Deploy

Antes de empacotar uma release, rode os gates locais:

```bash
bun run lint
bun x tsc --noEmit
bun run test -- --run
bun audit
bun run build
bun run test:e2e
```

### 1. Build local

```bash
bun install --frozen-lockfile
bun run build
```

### 2. Preparar `dist/standalone`

O `Dockerfile` é runtime-only e copia artefatos já gerados. Em vez de depender de `cp` com globs frágeis, use o script oficial do repositório:

```bash
bun run dist:standalone
```

Esse comando recria `dist/standalone` a partir de:

- `.next/standalone`
- `.next/static`

Além disso, o build falha se o output tracing puxar bancos SQLite, WAL/SHM, backups ou artefatos `.bak` para dentro do bundle do Next, e o script remove qualquer diretório `db/` remanescente de `dist/standalone`.

### 3. Criar arquivo de deploy

No macOS, desabilite resource forks para evitar arquivos `._*` dentro do tarball:

```bash
COPYFILE_DISABLE=1 tar czf /tmp/megasena-deploy.tar.gz --no-mac-metadata \
  dist/standalone/ public/ server.ts lib/ package.json bun.lock bunfig.toml tsconfig.json \
  scripts/start-docker.ts scripts/check-production-freshness.ts scripts/check-edge-csp.ts db/migrations/ Dockerfile
```

### 4. Enviar para o servidor

```bash
scp /tmp/megasena-deploy.tar.gz user@server:/path/to/compose/dir/
```

### 5. Descompactar e subir no servidor

```bash
cd /path/to/compose/dir
tar xzf megasena-deploy.tar.gz
bun install --production --frozen-lockfile
docker build -t megasena-analyser-app:vX.Y.Z .
docker stop megasena-analyzer && docker rm megasena-analyzer
docker compose up -d
```

### 6. Verificar

```bash
docker logs megasena-analyzer
curl -I https://megasena-analyzer.com.br/
curl -I https://megasena-analyzer.com/
bun run deploy:verify
bun run security:csp:edge
```

Saída esperada nos logs:

- `[OK] API server ready`
- `[OK] All services started successfully`

`bun run deploy:verify` deve confirmar que `/api/health` no domínio público retorna a mesma versão de `package.json`. Se a versão observada for antiga, trate o deploy como incompleto mesmo que a imagem, o contêiner e o CI estejam verdes.
`bun run security:csp:edge` deve confirmar que Cloudflare/Traefik não substituem a CSP nonce-based da aplicação nem a CSP deny-by-default da API.

## Dockerfile

O `Dockerfile` atual:

- copia `dist/standalone/`
- copia `public/`
- copia `server.ts`, `lib/`, `package.json` e `tsconfig.json`
- sobe `scripts/start-docker.ts`, que inicia o `server.ts` em Bun e o `server.js` standalone do Next
- encerra filhos com `SIGTERM`, aguarda `process.exited` e escala para `SIGKILL` após o período de graça; `proc.killed` não deve ser usado como prova de que o processo saiu
- usa health check em `http://localhost:3201/api/health`
- executa o runtime como usuário não-root `bun` (UID/GID 1000); volumes bind-mounted de `db/` e `logs/` precisam permitir escrita por esse UID/GID

### Por que o build é local

O projeto depende de `bun:sqlite` no backend Bun. O caminho validado aqui é:

1. gerar o build fora do Docker
2. sincronizar `dist/standalone`
3. montar uma imagem somente de runtime

## `docker-compose.yml`

Pontos relevantes:

- no arquivo local, publica as portas somente em `127.0.0.1`
- em produção, exponha publicamente apenas o proxy reverso; a API Bun deve permanecer restrita à rede interna do Docker/proxy
- mantém volume `./db:/app/db` para persistir o SQLite
- mantém volume `./logs:/app/logs`
- injeta `NEXT_PUBLIC_BASE_URL=https://megasena-analyzer.com.br`

## Traefik

No ambiente de produção, o Traefik gerencia:

1. redirect HTTP -> HTTPS
2. conteúdo do domínio primário
3. redirect 301 dos domínios secundários
4. HSTS no ponto que termina TLS

Middlewares relevantes:

- rate limiting
- redirect para domínio primário
- headers de segurança compartilhados no edge do proxy reverso

O middleware de headers do proxy reverso deve aplicar, nas respostas HTTPS:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Não aplique HSTS em respostas HTTP. Se `preload` for mantido, confirme antes que todos os subdomínios cobertos por `includeSubDomains` suportam HTTPS permanente.

Não sobrescreva a CSP gerada pela aplicação sem validar `tests/app/security.spec.ts`. A CSP do app depende de nonce por request para hidratação correta do App Router e para remover `unsafe-inline` de `script-src` e `style-src`; somente `style-src-attr 'unsafe-inline'` é permitido para atributos `style` gerados por bibliotecas de visualização.
Se a resposta pública exibir `unsafe-inline` em `script-src`/`style-src`, `unsafe-eval`, domínios como `cdn.tailwindcss.com`/`aistudiocdn.com` ou headers obsoletos como `X-XSS-Protection`, investigue Cloudflare Response Header Transform Rules, Snippets/Workers e o middleware de headers do Traefik. Quando a mesma CSP aparecer em HTML e `/api/health`, trate como regra global de response headers até prova em contrário; Client-Side Security/Page Shield é hipótese secundária. O proxy reverso deve aplicar HSTS, não `Content-Security-Policy`. Com token Cloudflare read-only, diferencie zona inacessível de zona acessível sem regra candidata antes de encerrar a investigação.

## Nginx

`nginx.conf.example` é apenas um fallback público para instalações sem Traefik. Ele deve permanecer alinhado a este guia:

- HSTS é emitido somente no bloco HTTPS.
- CSP não é sobrescrita no Nginx; a aplicação gera a CSP com nonce por request.
- `X-XSS-Protection` não é usado, porque é obsoleto em navegadores modernos.

## Atualização de Banco

Fluxo geral:

1. copiar o banco do servidor
2. rodar `bun scripts/pull-draws.ts --incremental`
3. rodar `bun scripts/optimize-db.ts`
4. devolver o banco ao servidor e reiniciar o contêiner

## Troubleshooting

### `Could not find a production build`

O `dist/standalone` foi gerado de forma incompleta. Refaça:

```bash
bun run build
bun run dist:standalone
```

### `Standalone contém artefatos SQLite locais`

O build encontrou banco SQLite, WAL/SHM, backup ou arquivo `.bak` dentro de `.next/standalone`. Não publique esse output. Remova artefatos locais de `db/` ou ajuste `outputFileTracingExcludes`, então refaça:

```bash
bun run build
bun run dist:standalone
```

### Erros com arquivos `._001_initial_schema.sql`

O tarball foi criado sem `COPYFILE_DISABLE=1` e `--no-mac-metadata`. Refaça o arquivo de deploy com essas flags.

### Health check da API falhando

Verifique:

- existência de `/app/db/mega-sena.db`
- volume correto em `docker-compose.yml`
- migrações SQL válidas em `db/migrations/`

### Cache stale no Cloudflare

Durante testes, use `?cb=timestamp`. Se o problema persistir, faça purge de cache no painel do Cloudflare.

### Release publicada, mas produção continua em versão antiga

Esse estado deve ser tratado como deploy incompleto. CI verde, imagem Docker publicada ou tag Git existente não provam que o servidor público está rodando a release.

Diagnóstico mínimo:

```bash
bun run deploy:verify
bun run security:csp:edge
curl -fsS https://megasena-analyzer.com.br/api/health
ssh -o BatchMode=yes -o ConnectTimeout=10 user@server 'docker ps --format "{{.Names}} {{.Image}} {{.Status}}"'
```

Com acesso Cloudflare read-only, acrescente `CLOUDFLARE_ACCOUNT_ID` para o mesmo verificador executar Cloudflare Trace e listar passos matched que citam CSP. Isso ajuda a separar Response Header Transform Rules, Page Shield/Client-side security, Workers/Snippets e proxy reverso sem publicar IDs, tokens ou nomes privados em docs. Sem acesso à API, use o fingerprint curto da CSP compartilhada, o dono provável e as ações de remediação impressas pelo verificador para comparar manualmente a política pública com regras do painel ou do proxy; `shared_response_headers` prioriza Response Header Transform Rules e middleware de headers antes de Page Shield. Não registre IDs de regras, hosts, caminhos reais ou contas no repositório. Se houver uma URL de origem direta, rode `ORIGIN_BASE_URL=https://origin.example.com bun run security:csp:edge` localmente para provar se a origem mantém a CSP correta enquanto a borda substitui; use placeholder em docs e nunca registre o alvo real. Para simular condições específicas, use apenas headers públicos em `CLOUDFLARE_TRACE_HEADERS_JSON`; não inclua cookies ou tokens.

Se o SSH falhar, corrija conectividade, firewall, DNS, chave ou allowlist fora do repositório antes de tentar novo deploy. Não publique IPs, usuários, caminhos reais, chaves ou logs com segredos em commits, issues ou release notes.

Quando o acesso voltar:

1. Recrie o tarball a partir de um build local limpo:
   ```bash
   bun install --frozen-lockfile
   bun run build
   bun run dist:standalone
   COPYFILE_DISABLE=1 tar czf /tmp/megasena-deploy.tar.gz --no-mac-metadata \
     dist/standalone/ public/ server.ts lib/ package.json bun.lock bunfig.toml tsconfig.json \
     scripts/start-docker.ts scripts/check-production-freshness.ts scripts/check-edge-csp.ts db/migrations/ Dockerfile
   ```
2. Envie o tarball para o diretório de compose no servidor.
3. Faça backup do banco e dos logs persistidos antes de substituir contêineres.
4. Reconstrua a imagem no servidor com tag explícita da release.
5. Suba o compose e aguarde health check do contêiner.
6. Rode `bun run deploy:verify` da máquina local e só considere concluído quando `/api/health` público retornar a mesma versão de `package.json`.
