# Guia de Deploy

## Hospedagem Worker e migração

A versão 1.17.1 executa a aplicação em um Worker vinext/App Router, com SQLite
no Durable Object `MegaSenaData` pelo binding privado `DATA`. Não há API
administrativa pública do banco. O caminho Docker abaixo permite execução local
e recuperação durante a migração.

A migração inclui reconciliação integral do snapshot final e arquivamento da
origem anterior. Serviços e jobs legados foram retirados; os bancos originais e
as cópias recuperáveis permanecem preservados. Recibos, hashes e localizações
ficam no runbook privado. Uma restauração futura exige também reconciliar as
escritas realizadas no destino após o corte.

### Preparação e aceite antes do DNS

Este guia contém procedimentos genéricos. Mantenha contas, identificadores,
endpoints operacionais, inventários DNS, recibos de implantação e evidências de
migração em armazenamento privado, fora do Git. A migração só está concluída
após aceite pelo domínio público, reconciliação final e retirada verificada da
origem. A preparação do candidato não comprova esses passos.

Confira capacidade e limites do destino na [documentação do provedor](https://developers.cloudflare.com/durable-objects/platform/pricing/).
Dimensione importação e consultas antes da transferência; monitore leituras,
gravações, CPU e armazenamento sem publicar dados de assinatura ou consumo.

1. Confirmar conta e zonas antes de cada escrita. Uma troca de credencial exige repetir a conferência.
2. Rodar lint, lint estrutural, typecheck, Vitest com cobertura, SQLite real Bun, `bun run security:braces`, `pnpm audit` e build standalone. A regressão da mitigação local deve preceder o audit, conforme SECURITY.md. Acrescentar `bun run build:cloudflare`, `bun run build:cloudflare:production` e `bun run test:cloudflare`. Verificar persistência Worker/DO, ingestão inválida, rollback transacional, rate limit e controles negativos de acesso interno. Inspecionar páginas, hidratação e Server Actions com Argent Chromium; não usar Playwright nesta migração.
3. Preparar staging distinto, com `IP_HASH_SECRET` de pelo menos 32 caracteres e origens CORS correspondentes ao domínio de staging. Configuração é por ambiente. Deploy é ação externa e exige autorização para o alvo exato. Usar o fluxo `cf` e descobrir comandos com `cf cli search`. Os scripts explícitos são `bun run deploy:cloudflare:staging` e `bun run deploy:cloudflare:production`.
4. Validar em staging `/api/health`, versão do artefato, dados, CSP por requisição, hidratação, Server Actions, 404/308, metadata, sitemap e robots. Repetir controles negativos, reinicialização do objeto e retenção. Build local não comprova comportamento publicado.
5. Verificar backup recuperável dos dados existentes e prova de restauração/retenção do destino antes de trocar DNS. Gerar snapshot consistente do SQLite do VPS com `VACUUM INTO`; não copiar o arquivo vivo. Importar por caminho privado validado, sem substituir silenciosamente registros existentes. O bootstrap público não migra auditoria ou logs privados; transferi-los exige escopo e destino aprovados.
6. Publicar no alvo autorizado e conferir a versão pública com `bun run deploy:verify`, CSP com `bun run security:csp:edge`, dados recentes e replay Argent. Usar `PRODUCTION_BASE_URL=https://staging.example.com` para apontar os verificadores ao staging. Trocar DNS somente após staging e backup aprovados; verificar novamente pelo domínio público.
7. Desativar o serviço do VPS somente após aceite público. Manter backup verificado e plano de retorno durante o período de retenção definido pelo responsável; não inferir um prazo nem apagar dados no cutover.

### Arquivamento do VPS e retirada do Coolify

Obtenha autorização específica para arquivar e retirar o ambiente anterior. Mantenha-o ativo até os gates acima passarem, incluindo os dados reais, o domínio público e a atualização diária verificada.

1. Identificar somente os serviços, contêineres, jobs e configurações pertencentes ao Mega-Sena como alvos, incluindo o staging antigo. Confirmar identificadores e dependências antes de alterar recursos. Preservar também um inventário privado completo dos recursos compartilhados imediatamente antes e depois da operação, para comprovar que os demais foram mantidos; um assert ou inventário antigo não substitui essa comparação independente.
2. Preservar em arquivo privado o snapshot final consistente do banco, os arquivos persistentes necessários, a configuração de deploy, a revisão/imagem exata e as instruções de restauração. Verificar integridade, checksums e recuperação. Segredos e dados privados ficam fora deste repositório público.
3. Após o aceite, encerrar os serviços/jobs antigos e remover seus recursos no Coolify, preservando os dados recuperáveis. Conferir se a operação do Coolify também apagaria volumes antes de executá-la. Remover o agrupamento do projeto apenas se não contiver outros aplicativos.
4. Confirmar ausência de processos/jobs ativos deste projeto no VPS e dos recursos correspondentes no Coolify. Repetir health, versão, dados, CSP e DNS públicos no Cloudflare; registrar o resultado e a localização privada do arquivo no runbook operacional privado.

### Dados e atualização diária

O build recebe `CLOUDFLARE_STAGING_ALLOWED_ORIGINS` ou `CLOUDFLARE_PRODUCTION_ALLOWED_ORIGINS` como lista de origens HTTPS separadas por vírgula. Staging usa lista vazia por padrão (sem acesso CORS entre origens); produção mantém a origem canônica. `ENVIRONMENT=production` preserva os controles de segurança nos dois alvos, enquanto `DEPLOYMENT_STAGE` distingue a indexação: staging envia `X-Robots-Tag: noindex, nofollow` e `robots.txt` com `Disallow: /`. Produção preserva a política pública atual.

O seed versionado contém concursos até **3065** e só é importado quando o banco do objeto está vazio (`BOOTSTRAP_PUBLIC_SEED=1`). Em 02/10/2026, o cliente local consultou o endpoint oficial `servicebus3`, importou o concurso de 01/10 e preservou todos os registros anteriores. O endpoint antigo `servicebus2` falhou; a configuração publicada pelo portal identifica o endereço atual. Essa prova local não substitui a execução agendada remota, que permanece um gate de aceite separado.

`DAILY_REFRESH_ENABLED=1` habilita o alarme de `MegaSenaData`. A primeira ativação agenda uma atualização; depois, o próprio objeto mantém o próximo **06:00 UTC / 03:00 Brasília**, mesmo sem visitas ao site. `ingestion_schedule` guarda horário, tipo de tentativa e revisão. Diário, retry e alarme nativo são persistidos na mesma transação antes da rede. Reinício conserva a agenda; entregas antecipadas não consomem outra tentativa. Sucesso ou esgotamento de três retries em 5/10/20 minutos preservam o próximo dia; uma conclusão antiga não sobrescreve uma revisão posterior.

`cloudflare/ingestion.ts` consulta a CAIXA antes de abrir a transação dos concursos, valida a resposta e acrescenta no máximo cinco concursos por lote, atualizando caches atomicamente. A sequência deve permanecer sem lacunas. Repetir um lote não duplica sorteios; conflito de data/dezenas aborta. `ingestion_status` registra sucesso, lote incompleto ou falha. Falhas esperadas da fonte conservam o sucessor já armado; erros de SQLite ou agendamento escapam para a plataforma. Falha não torna dados antigos em dados novos.

**Migração do agendador:** `cf` beta5 transforma `triggers: []` em ausência de configuração, preservando Crons remotos. Retire os registros anteriores explicitamente pela [operação oficial de schedules](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/schedules/methods/update/) com lista vazia e confirme por leitura que `schedules` está vazio. Essa operação é separada dos custom domains. O CLI instalado não expõe essa operação; o SDK distribuído com ele permite a correção pontual. Não considere um deploy comum prova de remoção. Depois, consulte uma vez o health público para ativar o objeto e comprove ingestão real e próximo alarme; os testes locais não substituem essa evidência.

A escolha segue o [contrato de alarmes da Cloudflare](https://developers.cloudflare.com/durable-objects/api/alarms/): entrega ao menos uma vez, um alarme por objeto e recorrência explícita. Cron é uma alternativa de agendamento. O alarme reúne agenda, recuperação e orçamento de tentativas no mesmo diário transacional; sua aceitação exige prova remota de execução. Alterações de Cron têm uma [janela documentada de propagação](https://developers.cloudflare.com/workers/configuration/cron-triggers/); remoção confirmada na API não impede um evento anterior ainda em propagação.

A retenção continua sendo 400 dias para auditoria e 30 dias para logs. O objeto executa a limpeza antes de consultar a CAIXA, permitindo expirar registros mesmo quando a ingestão falha. Verificar o agendamento, a retenção e os backups no ambiente real antes do aceite. Persistência do banco não comprova restauração.

Antes da migração, confira os valores efetivos `AUDIT_RETENTION_DAYS` e `LOG_RETENTION_DAYS` no VPS. O build aceita `CLOUDFLARE_STAGING_AUDIT_RETENTION_DAYS`, `CLOUDFLARE_STAGING_LOG_RETENTION_DAYS` e os equivalentes com `PRODUCTION`, mapeados aos mesmos nomes de bindings do runtime. Ausência mantém 400/30; valores não finitos ou não positivos desativam a eliminação daquela tabela, como no Bun. Preserve a política efetiva na transferência; alterar prazos exige sincronizar a política pública e os documentos LGPD.

O contador de tentativas e o próximo alarme são gravados numa transação de armazenamento. A falha da CAIXA só é tratada no handler depois que a política de retry foi persistida. Falhas de agendamento/armazenamento continuam sendo lançadas para permitir a recuperação da plataforma. Os testes workerd injetam uma falha de `setAlarm`, verificam rollback do contador e comprovam o agendamento no próximo processamento. Isso não substitui prova de uma execução diária no ambiente publicado.

### CI e evidência local

O workflow `Cloudflare Runtime` executa automaticamente os gates de código, auditoria, cobertura, SQLite Bun, seis runtimes workerd, build standalone e builds Cloudflare staging/produção, sem credenciais de deploy. O runtime do agendador inclui interrupção durante uma chamada de rede e retomada em outro processo. Ele não publica automaticamente. Os builds devem rodar em sequência: geram tipos de rotas em `.next`. A verificação visual desta migração usa Argent. O workflow Docker legado contém Playwright e agora só pode ser iniciado manualmente; não substitui o aceite visual exigido.

Ao transportar um build pronto, preserve os bytes de `.cloudflare/output/v0` e
verifique versão, ambiente, domínios e hash antes de `cf deploy --prebuilt`.
No macOS, crie arquivos tar com `COPYFILE_DISABLE=1` para não gerar metadados
AppleDouble `._*`. Esses metadados não são módulos JavaScript e devem ficar fora
do bundle e dos assets. Confira os membros do arquivo e o diretório restaurado
antes do upload. Um build e um CI bem-sucedidos não validam o transporte posterior.

### Decisão reavaliada: operação e manutenção

Revisão de 02/10/2026 com os eixos Standards/Spec do code-review e avaliação arquitetural independente. Requisitos prioritários: preservar dados e transações, manter contratos públicos, recuperar falhas sem duplicação, verificar a restauração e conservar um caminho de retorno.

| Solução | Benefício | Custo e decisão |
| --- | --- | --- |
| vinext + SQLite Durable Object | Reutiliza páginas, analytics e transações síncronas; já testado em staging | Escolha atual. Compatibilidade do framework exige gates reais; um objeto concentra as operações de banco. |
| Next/OpenNext + D1 | Reutiliza o build Next; D1 oferece transações em batch e replicação de leitura | Exige adaptar o contrato assíncrono e a consistência das consultas. Sem necessidade demonstrada, não justifica outra migração. |
| Arquivo público estático + API Worker/SQLite DO | Retira consultas de leitura do caminho de cada página do arquivo | Requer publicar páginas, sitemap, metadados e links de forma coerente após cada sorteio. Reavaliar se medições mostrarem gargalo de leituras. |

Renderer e armazenamento são decisões independentes: uma eventual troca para um [Worker customizado OpenNext](https://opennext.js.org/cloudflare/howtos/custom-worker) pode preservar o Durable Object. O olhar de manutenção em cinco anos favorece essa separação, migrações pequenas, dados exportáveis e restauração comprovada. As melhorias aplicadas agora são a gravação atômica do retry, a preservação da retenção configurada e o controle negativo que impede um falso positivo no teste de indisponibilidade. Não há evidência de saturação que justifique cache ou particionamento adicionais.

Fontes primárias consultadas: [guia Next.js da Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), [limitações do vinext](https://github.com/cloudflare/vinext), [transações SQLite e recuperação PITR](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [semântica de alarmes](https://developers.cloudflare.com/durable-objects/api/alarms/), [Malcolm Featonby sobre retries idempotentes](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) e [Pramod Sadalage/Martin Fowler sobre evolução de bancos](https://martinfowler.com/articles/evodb.html). São orientações publicadas, não entrevistas nem endosso deste projeto. A documentação atual recomenda vinext, mas reconhece lacunas; por isso, build e teste de fronteira não substituem a verificação do site real.

SQLite Durable Objects oferece recuperação para pontos dos últimos 30 dias; essa capacidade do provedor não comprova que nossa restauração foi exercitada. Antes do corte, registrar um ponto recuperável e testar restauração num destino isolado autorizado, com comparação de conteúdo. Nunca executar restauração sobre o objeto de produção como teste.

### Transferência privada dos registros retidos

`bun run scripts/cloudflare-retained-data.ts prepare <arquivo.snapshot.sqlite> <novo-diretório-privado>` valida um snapshot concluído por `VACUUM INTO`, sem WAL/SHM, e gera manifesto, lotes de importação e consultas de verificação. Guarde o SHA-256 emitido separadamente. Diretório e arquivos usam permissões 0700/0600; nunca inclua esses dados no Git ou imprima o readback privado.

Após conferir conta e namespace, aplique cada lote com `cf durable-objects namespaces query <namespace-id> --durable-object-name megasena --jurisdiction none --queries @<lote.json>`, salvando a resposta em arquivo privado. Execute `check-import <bundle> <respostas> <sha-confiável> [nome-do-lote]` imediatamente. Depois rode todas as consultas de verificação e `verify <bundle> <respostas> <sha-confiável>` pelo mesmo script. Um HTTP 200 não basta: a ferramenta rejeita erros SQL, resultados parciais e divergências em qualquer coluna.

Cada lote tem até 1.000 registros e 1 MiB de JSON em um único statement atômico. Repetições exatas não alteram registros; divergências abortam o lote. IDs de `audit_logs`/`log_events` são preservados; `user_bets` usa `id_destino = -id_origem` para não colidir com novos IDs positivos. Chaves estrangeiras envolvendo apostas exigem revisão e são rejeitadas pelo exportador. O manifesto registra esse mapeamento. Um snapshot pré-DNS não inclui escritas posteriores: suspenda o escritor antigo, capture o estado final e importe/verifique o delta antes de aposentar o serviço. Preserve os backups.

Calcule as chamadas de importação e releitura a partir dos lotes gerados; o limite de bytes pode exigir lotes menores. Execute em série, inicialmente uma chamada por segundo. Em 429 respeite `Retry-After`; falhas transitórias permitem até cinco tentativas do mesmo lote idempotente com espera exponencial. Conflitos de dados exigem reconciliação explícita. O procedimento completo e os controles negativos estão em [CLOUDFLARE-DATABASE.md](../agent_planning/CLOUDFLARE-DATABASE.md).

## Caminho legado Docker / recuperação

O caminho legado permite restaurar um ambiente isolado com Docker e Traefik, usando:

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

No caminho legado, os redirects ficam no arquivo dinâmico do Traefik (`megasena-analyzer.yaml`). Em produção, o Worker os atende com 301 e preservação de caminho/query. `lib/site-domains.json` centraliza os nomes; o destino usa a origem canônica de `BASE_URL`, nunca um header recebido do visitante.

Para aliases de staging, configure redirecionamento por correspondência exata de host para uma origem fixa, preservando caminho e query. Use os registros recomendados pelo provedor para [domínios de redirecionamento](https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/). Valide a configuração e depois o comportamento público; nenhum alias deve depender da origem aposentada.

### Corte dos domínios com `cf`

Os builds comuns não incluem associação de domínios. Após conferir snapshots, restauração, registros retidos e aceite do staging, construa o artefato de corte com `CLOUDFLARE_BIND_CUSTOM_DOMAINS=1 bun run build:cloudflare:production`. Isso declara o domínio primário e seus cinco aliases. Em staging, a mesma opção com `bun run build:cloudflare` declara somente `staging.megasena-analyzer.com.br`; preserve também sua origem CORS explícita.

Para preparar o destino sem aplicar DNS, use `cf workers versions create --mode production --prebuilt` com tag e arquivo privado de segredos e ative a versão pelo comando `cf workers deployments create`. Esses comandos são distintos de `cf workers triggers deploy --mode production --prebuilt`, que aplica domínios e Cron. Confira o `--help` dos comandos descobertos antes da operação. Só aplique os triggers de domínio após aceitar os dados reais e o rollback; conflitos com registros DNS existentes exigem inventário e cópia privada, não remoção cega. Mantenha a opção de domínios nos builds posteriores ao corte e confirme os seis hosts publicamente antes de retirar o Traefik.

Ao migrar zonas entre contas, confira a delegação no registrador e nos servidores autoritativos, os registros não relacionados ao site e a ativação de cada zona. Uma confirmação do painel não comprova propagação. Um conflito de domínio pode deixar outras alterações de triggers aplicadas, inclusive desativar o endereço temporário: releia o estado após qualquer falha. Substitua somente os registros exatos já inventariados. Confira HTTPS e redirects por uma segunda rede quando o cache DNS local ainda apontar à origem antiga; uma requisição com IP forçado é apenas diagnóstico, não prova isolada de propagação. Veja [ativação de zonas](https://developers.cloudflare.com/dns/zone-setups/troubleshooting/pending-nameservers/) e [domínios de Workers](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Pré-requisitos

- Node.js `>= 22.0.0` na máquina que compila o Next.js (CI fixa `22.23.2`)
- Bun `>= 1.4.2` na máquina que gera o build (CI usa a versão exata em `.bun-ci-version`)
- Docker no servidor; a imagem de runtime usa Bun 1.4.2 estável pinado por digest imutável
- Acesso SSH gerenciado fora do repositório

## Staging

Este repositório não possui workflow automático de staging nem endpoint de staging público versionado. Um deploy de staging só deve ser declarado concluído quando houver um alvo explícito e alcançável fora do repositório, por exemplo:

- host SSH ou contexto Docker remoto dedicado a staging;
- diretório de compose de staging separado do ambiente de produção;
- domínio/base URL de staging para health check;
- segredo `IP_HASH_SECRET` real configurado no ambiente remoto;
- opcional: `INDEXNOW_KEY` no ambiente remoto, para servir `/indexnow-key.txt` e usar `bun run seo:indexnow`;
- `TRUSTED_PROXY_IPS` definido quando `TRUST_PROXY_HEADERS=true` e o peer da API não for loopback;
- `INTERNAL_API_SECRET` forte se chamadas server-side internas precisarem escapar da cota pública de rate limit.

Não reutilize o alvo de produção como staging por inferência. Se o SSH ou o alvo remoto não estiver disponível, limite a entrega a preparar e validar o artefato local:

```bash
pnpm install --frozen-lockfile
bun run lint
bun run lint:ast
bun run typecheck
bun run test -- --run --coverage
bun run test:sqlite
pnpm audit
bun run build
bun run dist:standalone
COPYFILE_DISABLE=1 tar czf /tmp/megasena-staging-deploy.tar.gz --no-mac-metadata --no-xattrs \
  dist/standalone/ public/ server.ts lib/ package.json pnpm-lock.yaml pnpm-workspace.yaml bunfig.toml tsconfig.json patches/ \
  scripts/start-docker.ts scripts/check-production-freshness.ts scripts/check-edge-csp.ts scripts/backfill-prizes.ts scripts/cli-args.ts scripts/import-draws.ts db/migrations/ Dockerfile
docker build -t megasena-analyser-app:staging-local .
```

Depois de subir em um staging real, valide com o domínio de staging usando `PRODUCTION_BASE_URL=https://staging.example.com bun run security:csp:edge` e um health check equivalente ao `deploy:verify` apontado para o mesmo ambiente. Não publique usuários, hosts, IPs, caminhos reais ou segredos em commits, issues ou logs públicos.

## Fluxo de Deploy

> **Desde 2026-09-23 produção e staging rodam como Services do Coolify.** O cutover do script privado de deploy legado (`docker compose` no diretório antigo e nomes fixos de contêiner) não se aplica mais. Para publicar uma versão:
> 1. Construa a imagem com uma tag nova, a partir de um diretório de build limpo na VPS com o mesmo pacote de artefatos listado abaixo.
> 2. Troque a tag na cópia de trabalho do compose do Service.
> 3. Aplique com o script de update da VPS, que espera o contêiner ficar saudável.
>
> Para voltar, restaure a tag anterior e aplique de novo. O refresh de banco do `--with-db` (snapshot online via `VACUUM INTO`) ainda precisa ser portado para os nomes de contêiner do Coolify. Os passos manuais abaixo continuam como referência do empacotamento e das verificações.

Antes de empacotar uma release, rode os gates locais:

```bash
bun run lint
bun run lint:ast
bun run typecheck
bun run test -- --run --coverage
bun run test:sqlite
pnpm audit
bun run build
```

Verifique UI, navegação e comportamento visível com Argent, conforme README.md.
Nesta revisão o responsável proíbe Playwright; o fluxo Argent deve passar duas
vezes sem mudanças, com inspeção adicional de desktop/celular e das regressões.
Use tag `vX.Y.Z-betaN` para staging e `vX.Y.Z` para produção; tags e artefatos
locais não comprovam publicação. Respeite a autorização do responsável para
cada destino; autorização explícita da sessão para staging e produção dispensa
uma confirmação repetida.

### 1. Build local

```bash
pnpm install --frozen-lockfile
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
COPYFILE_DISABLE=1 tar czf /tmp/megasena-deploy.tar.gz --no-mac-metadata --no-xattrs \
  dist/standalone/ public/ server.ts lib/ package.json pnpm-lock.yaml pnpm-workspace.yaml bunfig.toml tsconfig.json patches/ \
  scripts/start-docker.ts scripts/check-production-freshness.ts scripts/check-edge-csp.ts scripts/backfill-prizes.ts scripts/cli-args.ts scripts/import-draws.ts db/migrations/ Dockerfile
```

### 4. Enviar para o servidor

```bash
scp /tmp/megasena-deploy.tar.gz user@server:/path/to/compose/dir/
```

### 5. Construir e atualizar o Service

```bash
cd /path/to/compose/dir
tar xzf megasena-deploy.tar.gz
# Dependencias de producao sao instaladas dentro do docker build (stage deps
# com corepack pnpm install --prod --frozen-lockfile); nao instale no host.
docker build -t megasena-analyser-app:vX.Y.Z-beta1 .
```

Antes de atualizar o Service, confira segredos obrigatórios sem imprimir valores,
salve um snapshot online do SQLite com `VACUUM INTO` e verifique sua integridade.
Altere somente a imagem na cópia de trabalho do compose do Service de staging e
aplique pelo update da VPS documentado no repositório privado. Não edite o compose
gerado pelo Coolify nem use o cutover legado com `docker stop`/`docker rm`.

Confira versão, saúde, CSP, interface desktop/celular e identidade imutável da
imagem em staging. Depois de autorizado, atribua a tag final à mesma imagem,
repita backup e update no Service de produção e compare a identidade dos dois
contêineres. Uma nova compilação precisa de nova verificação em staging.

Compare os dados com o snapshot anterior: concursos, auditoria e logs dentro da
retenção devem permanecer. O startup aplica a retenção documentada de logs
(30 dias) e auditoria (400 dias); uma redução de linhas só é aceitável quando as
linhas removidas estão fora dessa janela e o evento de retenção confirma a causa.

### 6. Verificar

```bash
docker logs "$SERVICE_CONTAINER"
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
- executa o runtime como usuário não-root `bun` (UID/GID 1000), sem capabilities Linux; código e dependências ficam root-owned, enquanto `db/`, `logs/` e `.next/cache/` permanecem graváveis por esse UID/GID
- usa `/app/migrations-source` como conjunto canônico de migrations da imagem, porque um volume persistente em `/app/db` pode conter arquivos antigos

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
- remove todas as capabilities Linux do processo; ambientes que precisem persistir logs devem montar `/app/logs` explicitamente
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

O caminho recomendado acrescenta só os concursos novos ao banco vivo, sem trocar o arquivo. Não há downtime e as linhas de `audit_logs`/`log_events` gravadas no servidor se preservam.

1. Localmente, busque os concursos novos na API da CAIXA (a VPS recebe 403 dela) e atualize o seed versionado:

   ```bash
   bun run db:pull -- --incremental --limit 6
   bun run db:export-draws          # db/seed/draws.json, datas ISO
   ```

2. Copie `db/seed/draws.json` para o diretório `db/` montado no contêiner (`/app/db`), onde o banco vive e onde o usuário do app tem escrita.
3. Confira o plano e depois aplique, dentro do contêiner em execução:

   ```bash
   docker exec <contêiner> bun run scripts/import-draws.ts /app/db/draws.json --dry-run
   docker exec <contêiner> bun run scripts/import-draws.ts /app/db/draws.json
   ```

   O script valida cada entrada e insere só os concursos ausentes. Os caches de frequência e de pares são recalculados na mesma transação, e a revisão de cache é invalidada. Ele aborta, sem gravar nada, se um concurso existente divergir em data ou dezenas ou se a sequência ficar com lacuna. Diferenças de premiação só são relatadas. Rodar de novo não tem efeito.
4. Apague a cópia do seed do diretório `db/` e confira `bun run deploy:verify`.
5. Confira as URLs públicas de `robots.txt`, `sitemap.xml` e `llms.txt` **sem `?cb=`**: o sitemap e o `llms.txt` precisam incluir o concurso recém-importado, e o `robots.txt` deve corresponder à origem. Se houver conteúdo antigo, purgue esses três arquivos no Cloudflare (Caching → Configuration → Custom Purge) e confira novamente. Se já estiverem atuais, a expiração natural do cache dispensa a purga. A origem pede 10 minutos de borda com `Cloudflare-CDN-Cache-Control`, mas a zona já reteve esses arquivos por 4 h, provavelmente por uma regra de cache com Edge TTL fixo; validar apenas URLs com cache-buster não prova atualização da borda.
6. Opcional: avise o IndexNow (Bing e parceiros) das páginas que mudaram. Isso exige `INDEXNOW_KEY` configurada no ambiente do app, porque a chave é servida em `/indexnow-key.txt`, e a mesma chave na sua shell:

   ```bash
   bun run seo:indexnow -- --contests 3061,3062 --dry-run
   bun run seo:indexnow -- --contests 3061,3062
   ```

Antes de qualquer operação maior, faça backup online com `VACUUM INTO` dentro do contêiner. Nunca copie o arquivo SQLite vivo com `scp`, porque transações confirmadas podem estar no `-wal`. A troca do arquivo inteiro (`deploy.sh --with-db` no repositório privado) fica só para recuperação: ela perde as linhas de auditoria gravadas entre o snapshot e a troca e ainda não foi portada para o Coolify.

Ao comparar o banco depois de um reinício com o backup anterior, confira também a retenção automática: o servidor aplica a política existente na inicialização (logs: 30 dias; auditoria: 400 dias, salvo configuração explícita). Use o cutoff e a contagem do evento de retenção para distinguir expiração prevista de perda de dados. Nenhuma linha ainda dentro da retenção pode desaparecer; o importador não remove nem reescreve a telemetria.

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
   pnpm install --frozen-lockfile
   bun run build
   bun run dist:standalone
   COPYFILE_DISABLE=1 tar czf /tmp/megasena-deploy.tar.gz --no-mac-metadata \
     dist/standalone/ public/ server.ts lib/ package.json pnpm-lock.yaml pnpm-workspace.yaml bunfig.toml tsconfig.json patches/ \
     scripts/start-docker.ts scripts/check-production-freshness.ts scripts/check-edge-csp.ts db/migrations/ Dockerfile
   ```
2. Envie o tarball para o diretório de compose no servidor.
3. Faça backup do banco e dos logs persistidos antes de substituir contêineres.
4. Reconstrua a imagem no servidor com tag explícita da release.
5. Suba o compose e aguarde health check do contêiner.
6. Rode `bun run deploy:verify` da máquina local e só considere concluído quando `/api/health` público retornar a mesma versão de `package.json`.
