# Remediar os achados de supply chain do scan Codex Security

Este ExecPlan é um documento vivo. As seções `Progress`, `Surprises & Discoveries`,
`Decision Log` e `Outcomes & Retrospective` devem permanecer atualizadas enquanto o
trabalho avança.

## Purpose / Big Picture

O workflow de CI deve publicar somente a mesma imagem Docker que passou por um scan
Trivy bloqueante. Os verificadores locais e de CI também devem executar artefatos
imutáveis: React Doctor a partir do `pnpm-lock.yaml` e Gitleaks pelo digest do índice
multiarch de sua imagem. Ao final, os quatro achados do scan Codex Security validado
no commit `0e425305d6c62115a8786a1efb17cd61b644d9b2` estarão corrigidos e protegidos por
testes de contrato.

## Progress

- [x] (2026-07-29 00:26Z) Confirmar que o HEAD e os 256 hashes do artefato do scan
      representam a árvore inicial.
- [x] (2026-07-29 00:26Z) Validar os quatro achados contra o workflow, o hook, os
      scripts e o lockfile atuais.
- [x] (2026-07-29 00:26Z) Resolver o digest multiarch de
      `ghcr.io/gitleaks/gitleaks:v8.30.1`.
- [x] (2026-07-29 00:36Z) Reestruturar o workflow para construir por digest sem tags públicas, escanear
      esse digest com falha bloqueante e só então promovê-lo para as tags finais.
- [x] (2026-07-29 00:36Z) Remover toda execução mutável de React Doctor e exigir o
      caminho explícito do binário instalado pelo lockfile.
- [x] (2026-07-29 00:36Z) Fixar Gitleaks por tag e digest nos dois scanners e desabilitar rede dentro dos
      contêineres.
- [x] (2026-07-29 00:36Z) Adicionar testes de contrato para workflow, React Doctor e Gitleaks.
- [x] (2026-07-29 00:36Z) Configurar ast-grep com uma regra estrutural de supply chain e integrá-la ao
      pre-commit versionado.
- [x] (2026-07-29 00:36Z) Atualizar os contratos operacionais em `AGENTS.md`, `CLAUDE.md`,
      `docs/SECURITY.md` e `MEMORY.md`.
- [x] (2026-07-29 00:44Z) Registrar o resultado e as evidências em `memory/2026-07-28.md`.
- [x] (2026-07-29 00:44Z) Executar validação focada, lint estrutural e todos os gates aplicáveis.

## Surprises & Discoveries

- Observation: o Trivy Action v0.36.0 usa `exit-code: 0` por padrão.
  Evidence: a documentação oficial da action lista `0` como default e o workflow não
  sobrescreve o input. Assim, o job atual gera SARIF, mas não bloqueia a publicação ao
  encontrar vulnerabilidades HIGH ou CRITICAL.
- Observation: o pin correto para Gitleaks deve usar o digest do índice multiarch, não
  o manifesto específico da arquitetura local.
  Evidence: `docker buildx imagetools inspect ghcr.io/gitleaks/gitleaks:v8.30.1`
  retornou o índice OCI
  `sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f`,
  com manifestos `linux/amd64` e `linux/arm64`.
- Observation: `@ast-grep/cli` precisa executar seu postinstall para ligar o pacote
  opcional da plataforma ao binário principal.
  Evidence: a primeira instalação terminou com `ERR_PNPM_IGNORED_BUILDS`; após
  declarar `allowBuilds['@ast-grep/cli']: true`, o install frozen executou
  `node postinstall.js` e saiu com código zero.
- Observation: o hook ainda chamava `gitleaks protect --staged`, removido na linha 8
  da CLI.
  Evidence: o teste de contrato falhou contra o hook existente; o comando suportado
  pelo Gitleaks 8.30.1 é `gitleaks git --staged --redact`.
- Observation: o autoreview reportou que o job Trivy tentaria puxar em pull requests
  um digest que não foi enviado.
  Evidence: o finding foi rejeitado porque `.github/workflows/ci-cd.yml` mantém
  `if: github.event_name != 'pull_request'` tanto em `security` quanto em `publish`;
  esses jobs não executam em PR.
- Observation: o autoreview final mostrou que um script package bare
  (`react-doctor`) ainda poderia cair no `PATH` global quando o binário local
  estivesse ausente.
  Evidence: o teste de contrato foi tornado red-first e o script passou a apontar
  explicitamente para `./node_modules/.bin/react-doctor`.

## Decision Log

- Decision: usar o registro como área de staging somente por digest, sem publicar
  tags de branch, versão ou `latest` antes do scan.
  Rationale: o exporter `push-by-digest=true` mantém a identidade e as attestations
  geradas pelo BuildKit. O job de publicação promove exatamente esse digest após o
  Trivy, evitando reconstrução e evitando a perda de provenance que ocorreria ao
  carregar a imagem no Docker clássico.
  Date/Author: 2026-07-29 / Codex.
- Decision: configurar `exit-code: '1'` no Trivy.
  Rationale: sem esse input, HIGH/CRITICAL aparecem no relatório, mas não impedem a
  promoção. A exigência é um gate de segurança, não apenas telemetria.
  Date/Author: 2026-07-29 / Codex.
- Decision: o hook React Doctor deve falhar com instrução de instalação quando
  `./node_modules/.bin/react-doctor` não existir.
  Rationale: fallbacks globais ou remotos deixam de provar qual artefato foi executado;
  pular o check também enfraqueceria o contrato do hook. O comando continua simples:
  `pnpm install --frozen-lockfile`.
  Date/Author: 2026-07-29 / Codex.
- Decision: centralizar o pin Gitleaks em um único módulo usado pelos dois scanners.
  Rationale: há exatamente dois consumidores do mesmo artefato e pins duplicados podem
  divergir silenciosamente.
  Date/Author: 2026-07-29 / Codex.
- Decision: instalar `@ast-grep/cli@0.45.0` como devDependency exata e executar apenas
  seu binário local no CI e no hook.
  Rationale: depender de um binário global recriaria o mesmo problema de identidade
  removido do React Doctor. A versão tem licença MIT, release ativa, uso amplo e um
  único pacote runtime de suporte.
  Date/Author: 2026-07-29 / Codex.

## Outcomes & Retrospective

Os quatro achados foram removidos dos caminhos executáveis e ganharam testes de
regressão. A correção também revelou que o Trivy anterior era apenas informativo
porque seu exit code default era zero; o novo fluxo é realmente bloqueante. O pin
Gitleaks foi validado nos dois modos reais, incluindo 36 commits de histórico.

Os gates finais passaram: React Doctor 100/100, actionlint, ESLint, ast-grep,
TypeScript, pnpm audit, 265 testes Vitest e build de produção com standalone limpo.
Não houve mudança de UI, por isso browser/E2E não se aplicam. O único ponto não
verificado externamente é uma execução real do GitHub Actions/GHCR: fazê-la publicaria
um artefato e exigiria autorização separada. O Codex Security também não pôde ser
reexecutado antes da reabertura de cota; portanto este plano não afirma um novo placar
do scanner. O autoreview foi executado sobre o bundle local completo; seu único
finding foi rejeitado pela guarda explícita de evento descrita em
`Surprises & Discoveries`.

## Context and Orientation

`.github/workflows/ci-cd.yml` constrói a imagem e hoje aplica imediatamente todas as
tags geradas por `docker/metadata-action`. Um job posterior chamado `security` ignora
o digest produzido e escaneia `ghcr.io/<repo>:latest`. Essa tag só é atualizada por
`main`, portanto execuções de `develop` e tags de versão examinam outro artefato.

`package.json` declara `react-doctor` em `devDependencies`, com resolução concreta no
`pnpm-lock.yaml`, mas o script `doctor` pede `@latest`. `.githooks/pre-commit` prefere
o binário local, porém conserva fallbacks globais e remotos. A correção deve fazer
todos os caminhos usarem apenas `./node_modules/.bin/react-doctor`.

`scripts/scan-secrets.ts` examina a árvore de trabalho copiada para um diretório
temporário. `scripts/scan-secret-history.ts` examina todo o histórico Git alcançável.
Ambos executam `ghcr.io/gitleaks/gitleaks:v8.30.1` sem digest e com rede disponível.

## Threat Model and Security Acceptance

Os atacantes relevantes são um publicador ou registro comprometido, capaz de mover
uma tag npm ou OCI, e uma dependência vulnerável que entre em uma imagem publicável.
Os ativos são credenciais do desenvolvedor, código candidato ainda não publicado,
histórico Git e a integridade da imagem de release.

A correção é aceita somente se:

1. nenhuma tag final da aplicação for criada antes do scan;
2. Trivy receber `REGISTRY/IMAGE@sha256:...` do mesmo job de build e sair com código
   não zero para HIGH/CRITICAL;
3. o job de publicação depender do sucesso do job de segurança e promover exatamente
   o digest escaneado;
4. React Doctor não contiver `@latest`, `npx`, `pnpm dlx` nem fallback global;
5. os dois scanners Gitleaks compartilharem o pin
   `v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f`;
6. os contêineres Gitleaks forem executados com `--network=none`;
7. testes automatizados falharem se qualquer uma dessas invariantes regredir.

## Plan of Work

Primeiro, alterar `.github/workflows/ci-cd.yml`. O job `build` continuará produzindo a
imagem `linux/amd64`, mas usará o exporter de imagem do BuildKit com
`push-by-digest=true` e `name-canonical=true`. Em eventos que não sejam pull request,
os blobs e o manifesto ficarão disponíveis no GHCR somente pelo digest canônico. O
digest será exposto como output do job.

O job `security` autenticará no GHCR com permissão apenas de leitura e apontará Trivy
para `${REGISTRY}/${IMAGE_NAME}@${{ needs.build.outputs.digest }}`. Ele configurará
`exit-code: '1'`, continuará gerando SARIF e fará upload do relatório mesmo em caso de
achado. Um novo job `publish` dependerá de `build` e `security`, autenticará com
permissão de escrita e usará `docker buildx imagetools create --prefer-index=false`
para aplicar todas as tags do metadata action ao digest já aprovado. O comando gravará
metadata e comparará o digest promovido com o digest escaneado.

Depois, trocar o script `doctor` de `package.json` pelo caminho explícito
`./node_modules/.bin/react-doctor`. Simplificar `.githooks/pre-commit` para aceitar
somente o binário local e falhar com instrução clara quando as dependências não
estiverem instaladas.

Criar `scripts/security-tool-images.ts` com o único pin Gitleaks e importá-lo nos dois
scanners. Inserir `--network=none` antes dos mounts Docker.

Criar `tests/scripts/supply-chain-controls.test.ts`. O teste lerá o workflow, o
`package.json`, o hook e os scripts como contratos versionados. Também importará o pin
compartilhado. Ele validará identidade por digest, ordem dos jobs, bloqueio do Trivy,
ausência de seletores mutáveis e isolamento de rede.

Por exigência do contrato global deste workspace, criar `sgconfig.yml` e uma regra em
`ast-grep-rules/` que rejeite strings TypeScript com a imagem Gitleaks tagueada sem
digest. Integrar `ast-grep scan --config sgconfig.yml` ao hook pre-commit de modo que
uma correspondência bloqueie o commit.

Finalmente, atualizar apenas a documentação cujo contrato mudou e registrar a decisão
na memória legível do projeto. Não haverá alteração de aplicação, banco, API, UI,
versão ou changelog.

## Concrete Steps

Na raiz do repositório:

1. Editar os arquivos descritos em `Plan of Work` com patches pequenos.
2. Rodar o teste focado:

   bun x vitest tests/scripts/supply-chain-controls.test.ts --run

3. Provar que o ast-grep carregou regras efetivas e não encontrou violação:

   bun run lint:ast

4. Rodar React Doctor pelo artefato do lockfile:

   bun run doctor --verbose --scope changed

5. Rodar os gates do repositório:

   bun run lint
   bun run typecheck
   bun run test -- --run
   pnpm audit --prod
   bun run build

`bun run test:e2e` não é necessário porque não há mudança em UI, rotas ou runtime da
aplicação. O workflow não pode ser executado integralmente sem criar um evento no
GitHub e escrever no GHCR; essa mutação externa não está autorizada. O teste estático,
o parser do ast-grep e a validação de sintaxe YAML devem cobrir localmente o contrato.

## Validation and Acceptance

O teste focado deve passar e nomear explicitamente os quatro grupos: promoção Docker,
Trivy, React Doctor e Gitleaks. `ast-grep scan --inspect summary` deve mostrar pelo
menos uma regra efetiva e zero diagnósticos. Os gates gerais devem sair com código
zero.

Uma revisão do workflow deve mostrar o fluxo:

    build por digest -> Trivy no mesmo digest -> publish das tags

Não deve existir `image-ref` com `:latest` no job Trivy, `react-doctor@latest` em
arquivos executáveis, nem `ghcr.io/gitleaks/gitleaks:v8.30.1` sem `@sha256`.

## Idempotence and Recovery

As edições são determinísticas e podem ser reaplicadas. O workflow usa um digest
imutável como handoff, portanto um retry não promove um artefato diferente do que a
própria execução construiu. Se o scan falhar, o job de publicação não roda; os blobs
sem tag podem ser coletados pela retenção do registro sem ação manual. Nenhum comando
local deste plano publica, faz push, cria release ou altera produção.

## Artifacts and Notes

Os artefatos locais de origem são `findings.json`, `scan-manifest.json` e
`coverage.json` do scan `68f028e4-8366-44eb-af95-380c33c5f805`; eles não pertencem ao
repositório público.

O novo scan Codex Security não será repetido nesta execução: a ferramenta informou
cota indisponível até 2026-08-04 18:10. O fechamento será baseado no artefato completo
256/256, testes de regressão e gates locais, declarando essa limitação.

## Interfaces and Dependencies

O único pacote novo é `@ast-grep/cli@0.45.0`, fixado exatamente no lockfile e
autorizado em `pnpm-workspace.yaml` porque seu postinstall seleciona o binário nativo
da plataforma. O workflow usa apenas actions já fixadas por SHA e subcomandos já
presentes no Docker Buildx:
`push-by-digest`, `name-canonical` e `imagetools create`. O pin Gitleaks exportado por
`scripts/security-tool-images.ts` terá a assinatura:

    export const GITLEAKS_IMAGE: string;

Seu valor deve manter simultaneamente a tag humana para auditoria e o digest imutável
do índice OCI.
