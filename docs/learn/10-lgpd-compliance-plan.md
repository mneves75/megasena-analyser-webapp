# 10 - LGPD: Verificação e Plano de Conformidade (2026+)

> Aviso: este capítulo descreve o que o **código** faz e propõe ações técnicas. Não é
> parecer jurídico. Decisões de base legal e prazos devem ser validadas pelo
> encarregado (DPO) e/ou jurídico. Itens não verificáveis no código estão marcados.

## O que este capítulo ensina

Quais dados pessoais o sistema realmente trata, como ele já se protege, e um plano
minucioso (banner, políticas, segurança, criptografia, direitos do titular) até a
conformidade plena com a LGPD (Lei 13.709/2018) considerando o contexto de 2026+.

## Por que isso importa

LGPD não é checklist de fim de projeto: é um requisito contínuo. Tratar IP é tratar
dado pessoal. Saber exatamente o que se coleta e onde fica é pré-condição para
responder a um titular ou à ANPD sem improviso.

## Modelo mental

Três perguntas, sempre: **o que coletamos, por quê, e por quanto tempo?** Se você não
consegue responder olhando o código, há uma lacuna de conformidade.

---

## 1. Inventário de dados pessoais (verificado no código)

### Lado servidor (SQLite)

| Dado | Onde entra | Proteção aplicada |
| --- | --- | --- |
| Endereço IP (como pseudônimo) | `server.ts` → `pseudonymizeIp` | `lib/security/pseudonymize.ts`: HMAC-SHA256 com salt de 30 dias; grava `hmac-sha256:v1:<janela>:<digest>` em `client_id_hash`. Nunca grava IP cru |
| User-agent | header HTTP | truncado a 120 chars, sem caracteres de controle (`lib/audit.ts`, `lib/log-store.ts`) |
| Rota, método, status, duração, `request_id` | operacional | `request_id` é `crypto.randomUUID()`; sem correlação com pessoa |
| `metadata_json` | fornecido pelo chamador | `sanitizeStructuredMetadata` redige `authorization|token|secret|password|cookie` |

### Lado cliente (`localStorage`, nunca transmitido)

| Chave | Escrita por | Valor |
| --- | --- | --- |
| `megasena-theme` | `components/theme-provider.tsx` | `light`/`dark`/`system` |
| `megasena-privacy-ack` | `components/storage-disclosure.tsx` | versão da política (ex.: `2026-05-20`) |

**Sem cookies, sem `sessionStorage`, sem login, sem analytics de terceiros** (verificado
por grep). Estas duas chaves são todo o footprint de armazenamento no navegador, e o
banner as nomeia explicitamente.

## 2. O que já está conforme (verificado)

- **Minimização:** IP pseudonimizado, UA truncado, sem identificadores diretos.
- **Pseudonimização forte com fail-closed:** em `NODE_ENV=production`, sem
  `IP_HASH_SECRET` (≥32 chars) o servidor faz `process.exit(1)` antes das migrations
  (`server.ts`). O único opt-in é `IP_HASH_SECRET_AUTOGENERATE=true`, restrito a E2E.
- **Salt rotativo de 30 dias:** janela em `pseudonymize.ts` reduz vínculo de longo prazo
  entre registros do mesmo IP.
- **Sanitização recursiva de metadados:** `sanitize-metadata.ts` (profundidade 4, array
  25, string 500, detecção de ciclo).
- **Retenção automatizada (hard delete):** `audit-retention.ts` e `log-retention.ts`
  (24h; defaults 400/30 dias). Migração `006` removeu `deleted_at` (exceção de
  no-soft-delete aprovada).
- **Banner de transparência:** `storage-disclosure.tsx` exige reconhecimento e cita as
  chaves; some após aceite.
- **Direitos do titular:** página `app/privacy/direitos/page.tsx` +
  `RightsRequestTemplate` com `mailto:privacidade@megasena-analyzer.com.br` e modelo
  pronto. Cobre Art. 18 (acesso, correção, eliminação, portabilidade, informação) e
  petição à ANPD.
- **Políticas publicadas:** `app/privacy/page.tsx` (Política), `app/terms/page.tsx`
  (Termos), com textos em `lib/i18n.ts`. RoPA em `docs/LGPD-COMPLIANCE.md`.
- **Segurança em trânsito:** TLS terminado no proxy reverso; HSTS no proxy (não no app,
  por decisão consciente em `proxy.ts`).

## 3. Lacunas e plano de remediação (priorizado)

> Cada lacuna abaixo foi confirmada por leitura de código. "Esforço" é estimativa.

### Prioridade alta

1. **Sanitização como defesa em profundidade na persistência.**
   - Estado: `lib/log-store.ts:buildLogRow` serializa `metadata` sem chamar
     `sanitizeStructuredMetadata`. A redação só acontece antes, em `logger.ts`. Um
     chamador direto de `enqueueLogEvent` burlaria.
   - Ação: chamar `sanitizeStructuredMetadata` dentro de `buildLogRow` (idempotente),
     com teste provando que `{ password: 'x' }` vira `[REDACTED]` ao persistir.
   - Esforço: baixo. Arquivos: `lib/log-store.ts`, `tests/lib/log-store.test.ts`.

2. **Criptografia em repouso do banco — decisão e implementação.**
   - Estado: o SQLite (`db/mega-sena.db`) **não é criptografado em repouso** (não há
     SQLCipher nem chave de cifra no código). Dado pessoal vive nas tabelas
     `audit_logs`/`log_events` em texto (pseudonimizado, mas legível).
   - Ação: avaliar criptografia em repouso. Opções: (a) cifra de volume/disco no host
     (mais simples, recomendada para deploy único); (b) SQLCipher (muda o driver;
     `bun:sqlite` não suporta nativamente — exigiria avaliação). Documentar a decisão em
     `docs/SECURITY.md`.
   - Esforço: médio (a) / alto (b). Verificável: ausência de qualquer `PRAGMA key`/
     SQLCipher no código.

3. **Definir o prazo oficial de retenção de auditoria.**
   - Estado: 400 dias (`.env.example`) vs 365 (default do CLI `prune-audit-logs.ts`) vs
     recomendação de 180 dias em `docs/LGPD-COMPLIANCE.md`.
   - Ação: decidir um número, alinhar `.env.example`, o default do CLI e o RoPA;
     justificar o prazo (princípio da necessidade, Art. 15-16).
   - Esforço: baixo (decisão + alinhamento).

### Prioridade média

4. **Resolver `session_id`/`user_id` em `log_events`.**
   - Estado: colunas existem (migração `005`/`006`) mas nada as popula.
   - Ação: remover as colunas (migração nova) **ou** documentá-las no RoPA com base
     legal antes de qualquer uso. Não deixar campo "fantasma" de dado pessoal.
   - Esforço: baixo-médio.

5. **Procedimento formal de verificação de identidade do titular.**
   - Estado: fluxo de direitos é 100% manual por e-mail; `docs/LGPD-COMPLIANCE.md`
     menciona "prova técnica de titularidade", mas não há procedimento implementado.
   - Ação: documentar um procedimento concreto (que evidência aceitar, como evitar
     divulgar dado a quem não é titular, SLA de resposta de 15 dias do Art. 19).
   - Esforço: baixo (documental/processual).

6. **Rotação de backups verificável.**
   - Estado: `scripts/backup-database.ts` cria backups com retenção, mas não há
     agendamento commitado; o RoPA (T6) assume rotação. Backups contêm dado pessoal
     pseudonimizado.
   - Ação: commitar o agendamento (cron/systemd timer documentado) e a política de
     retenção/cifra dos backups; confirmar onde rodam.
   - Esforço: médio (infra).

### Prioridade baixa / documentação

7. **Documentar `hashForAudit` (SHA-256 puro) para números de aposta.**
   - Estado: `server.ts` usa `hashForAudit(numbers)` (SHA-256 sem HMAC). Números de
     aposta não são dado pessoal, mas o uso não está descrito na política.
   - Ação: nota em `docs/PRIVACY.md` esclarecendo o propósito (deduplicação/auditoria,
     não identificação).

## 4. Banner, políticas e textos (estado e melhorias)

- **Banner (`storage-disclosure.tsx`):** versionado por `STORAGE_VERSION`. Boa prática:
  ao mudar finalidade/coleta, **incrementar a versão** força novo reconhecimento.
- **Sincronização obrigatória (regra do projeto):** mudanças que afetem coleta,
  retenção, finalidade, base legal, operador ou direitos exigem atualizar em conjunto
  `docs/PRIVACY.md`, `docs/LGPD-COMPLIANCE.md` (RoPA), `lib/i18n.ts` e o banner. Faça
  disso um item de checklist de PR.
- **Idioma:** todos os textos ao usuário em pt-BR (`lib/i18n.ts`). Manter.

## 5. Base legal e RoPA (verificação)

| RoPA | Atividade | Base alegada | Verificável no código? |
| --- | --- | --- | --- |
| T1 | `log_events` | Art. 7º IX (legítimo interesse) | Sim (writes minimizados) |
| T2 | `audit_logs` | Art. 7º IX + VI | Sim |
| T3 | rate limiting em memória | Art. 7º IX | Sim (chave = IP pseudonimizado, não persistido) |
| T4 | preferências `localStorage` | Art. 7º IX | Sim (sem PII, lado cliente) |
| T5 | CDN Cloudflare | Art. 7º IX + Art. 33 | Não (relação com operador; fora do código) |
| T6 | backup SQLite | Art. 7º IX | Não (operacional; ver lacuna 6) |

O "teste de balanceamento" do legítimo interesse (Art. 10) é análise jurídica
documental — **não verificável no código** e deve ser mantido por jurídico/DPO.

## 6. Incidentes

`docs/INCIDENT-RESPONSE.md` define o processo (Art. 48). Regra técnica importante: o
pós-mortem público (`docs/INCIDENT-RESPONSE-TEMPLATE.md`) **nunca** deve conter valores
de segredo ou dado pessoal — a sanitização de logs ajuda, mas a revisão humana do
pós-mortem é obrigatória.

## 7. Checklist de conformidade (resumo acionável)

- [ ] Gap 1: sanitização em `buildLogRow` (+ teste).
- [ ] Gap 2: decisão e implementação de criptografia em repouso (doc em SECURITY.md).
- [ ] Gap 3: prazo único de retenção de auditoria (código + RoPA alinhados).
- [ ] Gap 4: remover ou documentar `session_id`/`user_id`.
- [ ] Gap 5: procedimento de verificação de identidade do titular (SLA 15 dias).
- [ ] Gap 6: rotação/cifra de backups commitada e documentada.
- [ ] Gap 7: nota sobre `hashForAudit` na política.
- [ ] Revisar versão do banner ao mudar qualquer finalidade.

## Como verificar isso no código

```bash
grep -n "pseudonymizeIp\|IP_HASH_SECRET" server.ts lib/security/pseudonymize.ts
grep -rn "localStorage.setItem" components
grep -n "sanitizeStructuredMetadata" lib/audit.ts lib/logger.ts lib/log-store.ts
grep -rn "PRAGMA key\|sqlcipher\|SQLCipher" .   # esperado: vazio (sem cifra em repouso)
grep -n "AUDIT_RETENTION_DAYS\|LOG_RETENTION_DAYS" server.ts .env.example
grep -n "privacidade@" lib/i18n.ts
```

## Mal-entendidos comuns

- **"Pseudonimizar = anonimizar."** Não. Pseudônimo ainda é dado pessoal sob a LGPD; só
  reduz risco. Por isso retenção e direitos continuam valendo.
- **"IP não é dado pessoal."** Sob a LGPD, IP geralmente é tratado como dado pessoal.
- **"Sem login, sem LGPD."** Tratar IP/UA já aciona a lei.
- **"O banco está cifrado."** Não está em repouso neste código (ver gap 2).

## Exercícios

1. **(Fácil)** Liste todo dado pessoal tratado e onde é gravado. **Gabarito:** seção 1.
2. **(Médio)** Explique o efeito de rotacionar `IP_HASH_SECRET` num registro antigo.
   **Gabarito:** quebra a ligação entre registros pré/pós-rotação (digests diferentes),
   reforçando a minimização.
3. **(Difícil)** Implemente o gap 1 e prove com teste a redação de `password` na
   persistência de `log_events`.

---

### Procedência das afirmações

- **Verificado no código:** inventário de dados, pseudonimização/fail-closed, retenção,
  banner, fluxo de direitos, sanitização, ausência de cifra em repouso (grep).
- **Inferido do código:** classificação de prioridade e impacto das lacunas.
- **Conhecimento externo / jurídico:** artigos da LGPD e tratamento de IP como dado
  pessoal — orientação geral, a ser validada por DPO/jurídico; bases legais do RoPA são
  alegações de `docs/LGPD-COMPLIANCE.md`, não deriváveis só do código.
