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

| Domínio | Papel |
|--------|------|
| `megasena-analyzer.com.br` | Primário |
| `megasena-analyzer.com` | Redireciona 301 para `.com.br` |
| `megasena-analyzer.online` | Redireciona 301 para `.com.br` |
| `www.*` | Redireciona 301 para o domínio primário |

Os redirects ficam no arquivo dinâmico do Traefik (`megasena-analyzer.yaml`) no ambiente de deploy.

## Pré-requisitos

- Bun `>= 1.3.10` na máquina que gera o build
- Docker no servidor
- Acesso SSH gerenciado fora do repositório

## Fluxo de Deploy

### 1. Build local

```bash
bun install
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

Além disso, o script remove qualquer `db/*.db`, `db/*.db-shm`, `db/*.db-wal` ou `db/backups/*` que o output tracing tenha puxado para dentro do bundle do Next.

### 3. Criar arquivo de deploy

No macOS, desabilite resource forks para evitar arquivos `._*` dentro do tarball:

```bash
COPYFILE_DISABLE=1 tar czf /tmp/megasena-deploy.tar.gz --no-mac-metadata \
  dist/standalone/ public/ server.ts lib/ package.json tsconfig.json \
  scripts/start-docker.ts db/migrations/ Dockerfile
```

### 4. Enviar para o servidor

```bash
scp /tmp/megasena-deploy.tar.gz user@server:/path/to/compose/dir/
```

### 5. Descompactar e subir no servidor

```bash
cd /path/to/compose/dir
tar xzf megasena-deploy.tar.gz
bun install --production
docker build -t megasena-analyser-app:vX.Y.Z .
docker stop megasena-analyzer && docker rm megasena-analyzer
docker compose up -d
```

### 6. Verificar

```bash
docker logs megasena-analyzer
curl -I https://megasena-analyzer.com.br/
curl -I https://megasena-analyzer.com/
```

Saída esperada nos logs:

- `[OK] API server ready`
- `[OK] All services started successfully`

## Dockerfile

O `Dockerfile` atual:

- copia `dist/standalone/`
- copia `public/`
- copia `server.ts`, `lib/`, `package.json` e `tsconfig.json`
- sobe `start-docker.ts`, que inicia o `server.ts` em Bun e o `server.js` standalone do Next
- usa health check em `http://localhost:3201/api/health`

### Por que o build é local

O projeto depende de `bun:sqlite` no backend Bun. O caminho validado aqui é:

1. gerar o build fora do Docker
2. sincronizar `dist/standalone`
3. montar uma imagem somente de runtime

## `docker-compose.yml`

Pontos relevantes:

- expõe a porta `80` para o frontend
- mantém volume `./db:/app/db` para persistir o SQLite
- mantém volume `./logs:/app/logs`
- injeta `NEXT_PUBLIC_BASE_URL=https://megasena-analyzer.com.br`

## Traefik

No ambiente de produção, o Traefik gerencia:

1. redirect HTTP -> HTTPS
2. conteúdo do domínio primário
3. redirect 301 dos domínios secundários

Middlewares relevantes:

- rate limiting
- redirect para domínio primário
- headers de segurança compartilhados no edge do proxy reverso

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

### Erros com arquivos `._001_initial_schema.sql`

O tarball foi criado sem `COPYFILE_DISABLE=1` e `--no-mac-metadata`. Refaça o arquivo de deploy com essas flags.

### Health check da API falhando

Verifique:

- existência de `/app/db/mega-sena.db`
- volume correto em `docker-compose.yml`
- migrações SQL válidas em `db/migrations/`

### Cache stale no Cloudflare

Durante testes, use `?cb=timestamp`. Se o problema persistir, faça purge de cache no painel do Cloudflare.
