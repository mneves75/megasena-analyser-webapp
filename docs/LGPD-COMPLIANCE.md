# LGPD Compliance — Plano e Estado de Conformidade

**Última atualização:** 2026-05-20
**Lei aplicável:** Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais)
**Autoridade reguladora:** ANPD — Autoridade Nacional de Proteção de Dados

Este documento é a fonte única da verdade sobre o status LGPD do Mega-Sena Analyzer. Combina (a) o levantamento dos tratamentos de dados, (b) o plano de adequação e (c) o registro das medidas aplicadas. Atualize a tabela final sempre que houver alteração no tratamento.

---

## 1. Resumo executivo

O Mega-Sena Analyzer é um projeto independente, sem cadastro, sem autenticação, sem cookies de marketing e sem analytics de terceiros. O escopo de dados pessoais é estreito e operacional, mas mesmo assim atrai aplicação da LGPD por força do Art. 5º, I (definição ampla de dado pessoal) e do Art. 12 (dados pseudonimizados continuam protegidos quando reversíveis).

Tratamentos identificados:

1. Telemetria operacional do servidor (logs estruturados + auditoria) com IP pseudonimizado, user-agent truncado, rota, método, status, duração e identificador de requisição.
2. Preferência funcional armazenada localmente no navegador (`localStorage` `megasena-theme`).
3. Tráfego intermediado por Cloudflare (CDN + DDoS), que processa metadados de conexão sob suas próprias políticas e cláusulas padrão de transferência internacional.

Não há coleta deliberada de dado pessoal sensível, dado financeiro, identidade real ou base de cadastro. As apostas geradas não são persistidas.

---

## 2. Inventário de tratamentos (Record of Processing Activities — Art. 37)

### 2.1 Tabela RoPA resumida

| ID | Atividade | Dados tratados | Finalidade | Base legal (Art. 7º/11) | Retenção | Origem | Compartilhamento | Local de armazenamento |
|----|-----------|----------------|-----------|-------------------------|----------|--------|------------------|-----------------------|
| T1 | Log estruturado de eventos da aplicação | Pseudônimo do IP no formato `hmac-sha256:v1:<windowId>:<digest>` (HMAC-SHA256 com `IP_HASH_SECRET` e salt rotativo de 30 dias produzido por `lib/security/pseudonymize.ts`), user-agent truncado (120 chars), rota, método, status, duração, requestId, metadata sanitizada | Operação do serviço, diagnóstico, troubleshooting, observabilidade | Art. 7º, IX — legítimo interesse do controlador (operação técnica) | 30 dias (padrão `LOG_RETENTION_DAYS=30`) | Servidor da aplicação | Não compartilhado | SQLite local da instância (servidor) |
| T2 | Auditoria de eventos sensíveis (geração de aposta, leitura analítica) | Pseudônimo do IP no formato `hmac-sha256:v1:<windowId>:<digest>` (mesmo esquema HMAC-SHA256 com salt rotativo), user-agent truncado, rota, método, status, duração, requestId, metadata sanitizada | Segurança, integridade, rate limiting, evidência forense | Art. 7º, IX — legítimo interesse / Art. 7º, VI — exercício regular de direitos em processo administrativo | Padrão 400 dias (`AUDIT_RETENTION_DAYS=400`); reavaliar para 180 dias | Servidor da aplicação | Não compartilhado | SQLite local da instância (servidor) |
| T3 | Rate limit em memória | Mesmo pseudônimo HMAC-SHA256 do IP usado como chave LRU; nenhum IP em texto claro chega à cache | Proteção contra abuso | Art. 7º, IX — legítimo interesse | Janela rolante de 60 s; expiração automática + GC a cada 5 min | Servidor da aplicação | Não compartilhado | Memória do processo (não persistente) |
| T4 | Preferências funcionais (tema + reconhecimento do aviso de privacidade) | `megasena-theme` (`light\|dark\|system`) e `megasena-privacy-ack` (versão do aviso já visualizada, ex.: `2026-05-20`) | UX (memorizar preferência) e UX/transparência (evitar reexibir aviso já visto) | Art. 7º, IX — legítimo interesse / storage estritamente necessário equivalente | Persistência indefinida sob controle do titular | Navegador | Não sai do dispositivo do titular | `localStorage` do navegador |
| T5 | Tráfego HTTP intermediado por Cloudflare | IP, user-agent, headers HTTP padrão | CDN, mitigação DDoS, TLS | Art. 7º, IX — legítimo interesse / Art. 33 — transferência internacional sob salvaguardas | Conforme política da Cloudflare | Titular | Operador (Cloudflare) | Edge global da Cloudflare |
| T6 | Backup periódico do banco SQLite | Cópia dos itens T1+T2 | Continuidade e disaster recovery | Art. 7º, IX — legítimo interesse | Backup vivo: 7 dias rolantes; antes de purga: cópia obrigatória | Servidor da aplicação | Não compartilhado | Volume local com permissões restritas |

**Notas técnicas sobre o pseudônimo (T1, T2, T3):**

- O segredo `IP_HASH_SECRET` (≥ 32 caracteres) é exigido em produção. Sem ele, `server.ts` aborta com erro `security.ip_hash_secret_missing` (fail-closed).
- O E2E injeta um valor público de teste em seu próprio processo. Não existe relaxamento nem geração automática do segredo em produção.
- A rotação do segredo ou a passagem da janela mensal quebra a correlação entre pseudônimos antigos e novos, reduzindo risco de reidentificação histórica.

### 2.2 Não tratamos

- Nome, e-mail, telefone, endereço
- CPF, RG, documentos
- Dados financeiros (cartão, conta, PIX)
- Dados sensíveis (Art. 5º, II): origem racial/étnica, convicção religiosa, opinião política, filiação sindical, dado de saúde, vida sexual, genético/biométrico
- Dado de criança ou adolescente (o serviço é restrito a 18+ por força do Termo de Uso)
- Cookies de rastreamento publicitário ou analytics de marketing
- Pixels ou tags de terceiros
- Histórico individual de apostas (não persistimos)

---

## 3. Agentes de tratamento (Art. 5º, VI–VIII)

| Papel | Identificação | Responsabilidade |
|-------|---------------|------------------|
| Controlador | Equipe Mega-Sena Analyzer (projeto independente) | Decide finalidades e meios |
| Operador | Cloudflare, Inc. (CDN/edge) — cláusulas padrão Cloudflare | Processa tráfego em nome do controlador |
| Operador | Provedor de hospedagem do servidor (VPS) | Processa armazenamento sob direção do controlador |
| Encarregado (DPO) | Encarregado de Proteção de Dados — Mega-Sena Analyzer (`privacidade@megasena-analyzer.com.br`) | Canal único de comunicação com titulares e ANPD |

O encarregado é divulgado de forma clara e acessível na Política de Privacidade conforme Art. 41, §1º. O canal `privacidade@megasena-analyzer.com.br` é monitorado e responde dentro do prazo do Art. 19.

---

## 4. Bases legais por tratamento (Art. 7º)

| ID | Base legal | Justificativa |
|----|-----------|---------------|
| T1, T2, T3 | Art. 7º, IX — legítimo interesse | Operação técnica mínima necessária para servir requisições, prevenir abuso e diagnosticar falhas. Teste de balanceamento aplicado: (a) interesse legítimo do controlador (manter serviço seguro), (b) necessidade (dados mínimos pseudonimizados), (c) expectativa razoável do titular (visitar site público gera registros operacionais), (d) salvaguardas (pseudonimização, retenção limitada, sanitização recursiva). |
| T4 | Art. 7º, IX — legítimo interesse | Cookie/storage estritamente necessário para UX. Titular pode apagar a qualquer momento via configurações do navegador. |
| T5 | Art. 7º, IX + Art. 33 | Cloudflare opera sob cláusulas padrão. Transferência internacional documentada. |
| T6 | Art. 7º, IX | Cópias necessárias para continuidade. Aplicam-se os mesmos prazos de retenção dos dados originais; nunca exceder retenção operacional. |

Não há consentimento (Art. 7º, I) como base, porque não há tratamento opcional ou de marketing. Caso seja introduzido qualquer recurso opcional (ex.: salvar apostas em conta de usuário), exigirá nova análise de base legal.

---

## 5. Direitos do titular (Art. 18) — implementação

| Direito | Como exercer | Prazo de resposta | Implementação |
|---------|--------------|-------------------|---------------|
| Confirmação da existência de tratamento (I) | E-mail ao DPO | 15 dias | Resposta padrão indicando categorias T1–T6 e que não há cadastro |
| Acesso aos dados (II) | E-mail com prova de titularidade técnica (mesma faixa de IP / mesma identificação técnica recente) | 15 dias | Consulta via `request_id` ou janela temporal informada; exportação em JSON dos eventos correlacionáveis |
| Correção de dado incompleto/inexato/desatualizado (III) | E-mail | 15 dias | Não armazenamos identificadores diretos; pedido será respondido com explicação técnica e, se aplicável, anonimização adicional |
| Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade (IV) | E-mail | 15 dias | Aplicar `runAuditRetention` / `runLogRetention` com janela específica para o titular; gerar evidência de execução |
| Portabilidade (V) | E-mail | 15 dias | Export JSON dos eventos correlacionáveis ao titular |
| Eliminação dos dados tratados com consentimento (VI) | N/A — não tratamos com consentimento | — | Não aplicável; informar a base legal usada |
| Informação das entidades públicas/privadas com as quais houve compartilhamento (VII) | E-mail | 15 dias | Informar Cloudflare e provedor de hospedagem |
| Informação sobre a possibilidade de não fornecer consentimento e suas consequências (VIII) | N/A — sem consentimento | — | Não aplicável |
| Revogação do consentimento (IX) | N/A | — | Não aplicável |
| Revisão de decisões automatizadas (Art. 20) | N/A | — | Não tomamos decisões automatizadas sobre o titular |

**Canal único de contato:** `privacidade@megasena-analyzer.com.br`
**SLA interno:** confirmação de recebimento em até 72 horas; resposta final em até 15 dias contados do recebimento (prazo do Art. 19, §1º para os deveres correlatos do controlador).

---

## 6. Transparência (Art. 6º, VI e Art. 9º)

O titular recebe informação clara, precisa e facilmente acessível por meio de:

1. Política de Privacidade pública em `/privacy`, com identificação do controlador, encarregado, finalidades, bases legais, retenção, direitos e canal de exercício.
2. Termos de Uso públicos em `/terms`.
3. Banner de divulgação de armazenamento local (não-bloqueante, transparência ativa) na primeira visita.
4. Página dedicada de direitos em `/privacy/direitos` com modelo de requisição.
5. Link permanente para a política no rodapé de todas as páginas.

Não usamos dark patterns, pop-ups bloqueantes injustificados ou linguagem evasiva.

---

## 7. Segurança da informação (Art. 46)

### 7.1 Em trânsito

- TLS obrigatório em produção. HSTS `max-age=31536000; includeSubDomains; preload` aplicado pela API Bun quando a requisição é segura.
- HSTS no edge Cloudflare/Traefik para os ramos sem TLS terminado na aplicação.
- CSP nonce-based em produção; CSP deny-by-default em respostas JSON da API.
- Cabeçalhos defensivos em todas as respostas: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- CORS com allowlist explícita; preflight rate-limitado.

### 7.2 Em repouso

- Banco SQLite local com permissões `0640` sobre o arquivo e diretório `db/` restrito ao usuário do processo.
- Cópias de backup com permissões equivalentes; backups assinados com checksum SHA-256.
- Volume do servidor sob disco com criptografia em nível de sistema (LUKS/dm-crypt no provedor); recomendação registrada para hardening.
- Segredos jamais são commitados; `bun run security:secrets:history` audita histórico.

### 7.3 Pseudonimização (Art. 12 e 13)

- IPs nunca persistidos em texto claro: substituídos no momento da entrada por `hmac-sha256:v1:<windowId>:<digest>` quando `IP_HASH_SECRET` está configurado (produção); fallback `sha256:<digest>` existe apenas no caminho de desenvolvimento sem segredo.
- Aplicado: **HMAC-SHA256 com salt rotativo** (`IP_HASH_SECRET`, mínimo 32 caracteres) para impedir reverso por dicionário em horizonte de até 60 dias. Quando o segredo é rotacionado, hashes antigos deixam de correlacionar entre si, reforçando a desidentificação.
- Produção é **fail-closed**: a aplicação recusa-se a iniciar (`process.exit(1)`) quando `IP_HASH_SECRET` está ausente ou inválido. Isso garante que a promessa pública de pseudonimização HMAC nunca seja silenciosamente substituída por SHA-256 cru.
- **Provisionamento do segredo:**
  - Geração: `openssl rand -hex 32` (≥ 32 caracteres).
  - Produção via Docker: `IP_HASH_SECRET` é exigido em `docker-compose.yml` (`${IP_HASH_SECRET:?...}`) — o container não sobe sem ele.
  - `bun run start` (systemd / PM2 / shell) é **sempre fail-closed**. O operador precisa exportar `IP_HASH_SECRET` antes de subir o serviço.
  - E2E (`bun run test:e2e`): o `playwright.config.ts` define um `IP_HASH_SECRET` público de teste apenas dentro do `webServer.env`, limitado à execução dos testes.
  - Rotação recomendada: a cada 90 dias ou imediatamente após suspeita de comprometimento. Após rotação, hashes antigos perdem correlação automaticamente.
- User-agent truncado a 120 caracteres e filtrado de caracteres de controle, sem parser de fingerprint.
- Metadata estruturada passa por `sanitizeStructuredMetadata` antes da gravação/saída.

### 7.4 Controle de acesso

- Não há painel administrativo público.
- Scripts de manutenção (`audit:prune`, `log:prune`, `db:migrate`) exigem acesso SSH ao servidor.
- Logs de operação registram quem executou retenção (`reason`) e a janela aplicada.

### 7.5 Verificação explícita de mecanismos de segurança

| Mecanismo | Status no projeto | Justificativa / Mitigação |
|-----------|-------------------|---------------------------|
| **Cookies HTTP** | Nenhum cookie é definido pela aplicação | Não há sessão, autenticação ou rastreamento. Nenhum `Set-Cookie` no servidor (verificado em `server.ts` e `proxy.ts`). Banner de transparência informa o titular sobre uso de `localStorage` funcional. |
| **localStorage / sessionStorage** | `megasena-theme` (preferência funcional) e `megasena-privacy-ack` (versão do aviso de privacidade já visualizado) | Sem dado pessoal. Política de Privacidade lista as duas chaves explicitamente. Titular pode apagar via configurações do navegador. |
| **JWT / tokens de sessão** | Não aplicável | Não há autenticação. Sem JWT, sem refresh token, sem `Authorization`. Caso introduzido no futuro: usar algoritmo `EdDSA` ou `RS256`, expiração curta, `httpOnly` + `Secure` + `SameSite=Strict`, rotação de chave, blacklist em logout. |
| **MFA / 2FA** | Não aplicável | Não há contas de usuário. Caso introduzido: usar TOTP (RFC 6238) ou WebAuthn como segundo fator, com recuperação por códigos de uso único armazenados em hash. |
| **Hash de IP** | HMAC-SHA256 com salt rotativo (`IP_HASH_SECRET`); produção fail-closed quando o segredo está ausente | Substitui SHA-256 cru, que era reversível por força-bruta em 2³² endereços IPv4. HMAC com secret de 256 bits inviabiliza dicionário sem o segredo; salt rotativo a cada 30 dias quebra correlação histórica. Em produção, a aplicação recusa-se a iniciar sem o segredo, fechando o gap entre promessa pública e implementação. |
| **Hash de senhas** | Não aplicável | Sem cadastro/senha. Caso introduzido: usar `argon2id` (preferencial) ou `bcrypt` (cost ≥12), nunca SHA puro. |
| **Criptografia em trânsito** | TLS 1.2+ obrigatório em produção, HSTS preload no edge | Verificado no proxy reverso (Cloudflare/Traefik). |
| **Criptografia em repouso** | Volume do servidor com criptografia em nível de sistema (responsabilidade do provedor) + permissões `0640` no arquivo SQLite | Documentado como dever operacional do administrador da VPS. |
| **Segredos** | Variáveis de ambiente, nunca commitados; auditoria via `bun run security:secrets:history` | Política de rotação documentada em `docs/SECURITY.md`. |
| **Validação de input** | Zod em todas as rotas mutáveis; SQL parametrizado | Verificado em `server.ts` e `lib/db.ts`. |

### 7.6 Avaliação contínua

- `bun run lint` impede regressão em segurança via ESLint config.
- `bun run security:secrets` (CI) e `bun run security:secrets:history` (manual antes de release) auditam segredos.
- Code review obrigatório antes de merge.
- Reavaliação anual deste documento ou imediata a qualquer mudança nas finalidades.

---

## 8. Retenção e eliminação

| Dado | Retenção padrão | Eliminação |
|------|-----------------|------------|
| Logs estruturados (`log_events`) | 30 dias | `runLogRetention` agenda diária + script `bun run log:prune` |
| Auditoria (`audit_logs`) | 400 dias (legítimo interesse para evidência forense; reavaliar para 180 dias se não houver necessidade documentada) | `runAuditRetention` agenda diária + script `bun run audit:prune` |
| Backups (`db/backups/*`) | 7 dias rolantes | Script de rotação remove arquivos com mtime > 7 dias |
| Rate limit em memória | Janela rolante 60 s | GC interno a cada 5 minutos |
| Preferência de tema (cliente) | Indefinida pelo titular | Titular limpa via navegador |

A exceção de hard-delete para audit/logs está documentada porque (a) não há dado pessoal direto, (b) pseudonimização é robusta, (c) a retenção é limitada e justificada por interesse legítimo. Quando aplicável, pedidos do titular podem reduzir essa retenção.

---

## 9. Transferência internacional (Art. 33)

| Operador | País de processamento | Salvaguarda | Documento |
|----------|----------------------|-------------|-----------|
| Cloudflare, Inc. | Edge global (incluindo EUA) | Cláusulas-padrão Cloudflare (Data Processing Addendum), participação em padrões reconhecidos (ISO 27001, SOC 2) | https://www.cloudflare.com/trust-hub/ |
| Provedor de VPS | Conforme contratado | Cláusulas padrão do provedor; localização preferencial América do Sul/Europa | Contrato vigente com o provedor |

Não há transferência ativa de dado de titular além do trânsito necessário para entrega do conteúdo.

---

## 10. Plano de resposta a incidente (Art. 48)

### 10.1 Definição

Incidente de segurança é qualquer evento que afete (a) confidencialidade, (b) integridade ou (c) disponibilidade de dados pessoais tratados pelo controlador.

### 10.2 Fluxo

1. **Detecção e classificação** (0–4 h):
   - Quem detectou, quando, o que foi afetado.
   - Severidade: baixa / média / alta / crítica.
2. **Contenção** (0–24 h):
   - Isolar superfície afetada (revogar credencial, bloquear endpoint, reverter deploy).
   - Snapshot forense imediato do banco e dos logs vigentes.
3. **Erradicação e recuperação** (24–72 h):
   - Patch da falha raiz.
   - Restaurar serviço sem reintroduzir vulnerabilidade.
   - Validar com `bun run lint`, `bun run test -- --run`, `bun run build`, `bun run deploy:verify`.
4. **Notificação à ANPD** (Art. 48, §1º):
   - Em **prazo razoável**, considerando a gravidade. Para incidentes que envolvam dado pessoal com risco relevante: comunicar **em até 3 dias úteis** ao DPO interno (registro em changelog) e **em até 5 dias úteis** à ANPD (canal oficial), incluindo:
     - descrição da natureza dos dados afetados;
     - informação sobre os titulares envolvidos;
     - indicação das medidas técnicas de proteção;
     - riscos relacionados;
     - razões da demora, se houver;
     - medidas adotadas para reverter/mitigar os efeitos.
5. **Comunicação aos titulares** quando o incidente puder gerar risco ou dano relevante.
6. **Pós-incidente** (até 30 dias):
   - Post-mortem público sem dado sensível.
   - Atualização deste documento.
   - Ações corretivas com prazo no roadmap.

### 10.3 Template público de notificação

Arquivo em `docs/INCIDENT-RESPONSE-TEMPLATE.md`.

---

## 11. Reclamação à ANPD

O titular sempre pode apresentar reclamação à ANPD em https://www.gov.br/anpd/pt-br/canais_atendimento, independentemente do atendimento do controlador. Esse direito está sinalizado na Política de Privacidade e na página de direitos.

---

## 12. Plano de adequação — itens aplicados nesta entrega

| # | Item | Status | Arquivos |
|---|------|--------|----------|
| 1 | RoPA registrado | Concluído | `docs/LGPD-COMPLIANCE.md` |
| 2 | Identificação clara do controlador e do encarregado | Concluído | `docs/PRIVACY.md`, `app/privacy/page.tsx`, `lib/i18n.ts` |
| 3 | Política de Privacidade expandida com bases legais, retenção, direitos, encarregado, transferências internacionais | Concluído | `docs/PRIVACY.md`, `lib/i18n.ts`, `app/privacy/page.tsx` |
| 4 | Banner de divulgação de armazenamento local (não-bloqueante) | Concluído | `components/storage-disclosure.tsx`, integrado ao `layout.tsx` |
| 5 | Página de direitos do titular `/privacy/direitos` com modelo de requisição | Concluído | `app/privacy/direitos/page.tsx`, `lib/i18n.ts` |
| 6 | Endpoint `mailto:` para canal único `privacidade@megasena-analyzer.com.br` com modelo de requisição | Concluído | `app/privacy/direitos/page.tsx`, `components/privacy/rights-request-template.tsx` |
| 7 | Pseudonimização robusta de IP via HMAC com salt rotativo | Concluído | `server.ts`, `lib/security/pseudonymize.ts` |
| 8 | Sanitização recursiva de metadados antes da gravação | Já existente, validado | `lib/security/sanitize-metadata.ts` |
| 9 | Retenção automática agendada (logs 30 d, auditoria 400 d) | Já existente, documentado | `lib/log-retention.ts`, `lib/audit-retention.ts`, `server.ts` |
| 10 | Plano de resposta a incidente | Concluído | `docs/INCIDENT-RESPONSE.md`, `docs/INCIDENT-RESPONSE-TEMPLATE.md` |
| 11 | Link de direitos do titular no rodapé | Concluído | `components/footer.tsx`, `lib/i18n.ts` |
| 12 | Indicação de transferência internacional (Cloudflare) | Concluído | `docs/PRIVACY.md`, `lib/i18n.ts` |
| 13 | Reforço explícito de 18+ na Política de Privacidade | Concluído | `lib/i18n.ts` |
| 14 | Cabeçalhos de segurança defensivos em todas as superfícies | Já existente | `lib/security/csp.ts`, `lib/security/http.ts` |
| 15 | CSP nonce-based em produção, deny-by-default na API | Já existente | `proxy.ts`, `lib/security/csp.ts` |
| 16 | TLS + HSTS apenas com peer de proxy confiável | Já existente | `lib/security/http.ts` |
| 17 | Rate limit `100 req/min/IP` com chave pseudonimizada | Já existente | `server.ts` |
| 18 | Métodos não suportados retornam 405 com header `Allow` | Já existente | `server.ts` |
| 19 | `Content-Type: application/json` exigido em mutações | Já existente | `lib/security/http.ts`, `server.ts` |
| 20 | Limite de corpo (10 KB) em POST | Já existente | `server.ts` |

---

## 13. Próxima reavaliação

- **2027-05-20** (anual obrigatória)
- ou imediatamente em qualquer das condições:
  - alteração de finalidade do tratamento;
  - introdução de cadastro, autenticação, pagamentos ou compartilhamento com terceiro novo;
  - alteração de operador (mudança de CDN ou provedor);
  - incidente classificado como médio/alto/crítico;
  - publicação de novo entendimento vinculante pela ANPD.
