# Plano de Resposta a Incidente — Mega-Sena Analyzer

**Última atualização:** 2026-05-20
**Aplicabilidade:** todo evento de segurança envolvendo dados pessoais (Art. 48 LGPD) ou continuidade do serviço.

---

## 1. Definições

Incidente é qualquer evento que afete confidencialidade, integridade ou disponibilidade dos dados tratados pelo controlador. Incidente de segurança com dados pessoais é aquele que cause ou possa causar risco ou dano relevante aos titulares.

### Classificação de severidade

| Nível | Critério | SLA de resposta inicial |
|-------|----------|--------------------------|
| Crítico | Comprometimento confirmado de dados, indisponibilidade total > 1 h, RCE/SQLi/SSRF explorada | Imediato (até 1 h) |
| Alto | Tentativa séria de exploração, vazamento de configuração, falha que permitiria acesso a dado pseudonimizado | Até 4 h |
| Médio | Falha sem impacto direto a titulares (ex.: regressão de retenção, log incompleto) | Até 24 h |
| Baixo | Anomalia operacional sem impacto a dados (ex.: degradação temporária de cache) | Até 72 h |

---

## 2. Equipe

| Papel | Responsabilidade |
|-------|------------------|
| Encarregado (DPO) | Coordena classificação, notificação à ANPD e aos titulares; canal `privacidade@megasena-analyzer.com.br` |
| Responsável técnico do projeto | Lidera contenção, erradicação, recuperação |
| Operadores externos (Cloudflare, provedor VPS) | Acionados conforme contrato |

---

## 3. Fluxo passo-a-passo

### Fase 1 — Detecção (T0 a T0+1 h)

1. Registrar o alerta original (logs, monitoração, denúncia externa).
2. Atribuir um ID de incidente: `INC-YYYYMMDD-NN`.
3. Classificar severidade (ver tabela acima).
4. Abrir registro privado: `INC-YYYYMMDD-NN.md` (não commitar em branch pública).

### Fase 2 — Contenção (T0+0 a T0+24 h)

1. Isolar a superfície: revogar credenciais, bloquear endpoint, desligar componente.
2. Snapshot forense:
   - `db/mega-sena.db` (cópia somente leitura)
   - `db/mega-sena.db-wal` e `db/mega-sena.db-shm`
   - Últimos 7 dias de `log_events` e `audit_logs`
3. Congelar deploys até erradicação.

### Fase 3 — Erradicação (T0+24 h a T0+72 h)

1. Identificar causa raiz com análise estruturada (cinco-porquês).
2. Aplicar correção mínima e reversível.
3. Validar localmente:
   ```bash
   bun run lint
   bun run test -- --run
   bun run build
   ```
4. Code review obrigatório, mesmo em hot-fix.

### Fase 4 — Recuperação (T0+72 h em diante)

1. Deploy controlado.
2. `bun run deploy:verify` deve retornar a versão correta no `/api/health`.
3. Monitorar 24 h com observabilidade ativa.

### Fase 5 — Notificação à ANPD (Art. 48, §1º LGPD)

Quando o incidente envolver dado pessoal com risco ou dano relevante:

1. Comunicar internamente o encarregado em até 24 h após confirmação.
2. Notificar a ANPD em prazo razoável — referência: até 5 dias úteis para incidentes de severidade Alta ou Crítica.
3. Conteúdo mínimo da notificação (Art. 48, §1º):
   - Descrição da natureza dos dados afetados.
   - Informações sobre os titulares envolvidos.
   - Indicação das medidas técnicas e de segurança utilizadas para a proteção dos dados.
   - Riscos relacionados ao incidente.
   - Motivos da demora, no caso de a comunicação não ter sido imediata.
   - Medidas que foram ou serão adotadas para reverter ou mitigar os efeitos do prejuízo.
4. Canal oficial: peticionamento eletrônico no portal `gov.br/anpd`.

### Fase 6 — Comunicação aos titulares

Quando o incidente puder gerar risco ou dano relevante aos titulares:

1. Publicar aviso público no site (página /privacy ou banner do site).
2. Linguagem clara, sem termos técnicos opacos.
3. Indicar passos recomendados ao titular (ex.: limpar `localStorage`, monitorar conta).
4. Manter histórico do aviso em `docs/INCIDENT-RESPONSE.md`.

### Fase 7 — Pós-incidente (até T0+30 dias)

1. Post-mortem público sem dados sensíveis (em `docs/postmortems/INC-YYYYMMDD-NN.md`).
2. Ações corretivas com prazo no roadmap.
3. Atualização deste plano e da Política de Privacidade quando aplicável.

---

## 4. Critérios de notificação à ANPD

Notificar quando houver pelo menos uma das condições:

- Vazamento de dado pseudonimizado para terceiro não autorizado.
- Indisponibilidade prolongada (> 24 h) que impeça o exercício de direitos do titular.
- Comprometimento da chave `IP_HASH_SECRET` (rotação obrigatória + nova janela de salt).
- Acesso não autorizado ao banco SQLite no servidor.
- Comprometimento de credencial do provedor de hospedagem ou do Cloudflare.

Não notificar quando:

- Apenas falha de UX sem impacto a dados.
- Tentativa bloqueada por rate limit / CSP / CORS sem sucesso.
- Vulnerabilidade reportada via security researcher e corrigida antes de qualquer exploração.

---

## 5. Comunicação fora do projeto

| Destinatário | Quando | Canal |
|--------------|--------|-------|
| ANPD | Severidade Alta/Crítica em dados pessoais | Peticionamento eletrônico no `gov.br/anpd` |
| Titulares afetados | Quando houver risco ou dano relevante | Banner no site + nota em `/privacy` |
| Provedor VPS | Quando houver indício de comprometimento da infraestrutura | Canal de suporte do provedor |
| Cloudflare | Quando houver evidência de comprometimento de TLS, DNS ou WAF | Painel Cloudflare e ticket de suporte |

---

## 6. Pós-mortem público

Modelo em `docs/INCIDENT-RESPONSE-TEMPLATE.md`. O pós-mortem público:

- Não contém valores de segredos, credenciais, hashes íntegros nem URLs autenticadas.
- Contém: linha do tempo, causa raiz, impacto resumido, ações corretivas, lições aprendidas.
- É publicado no repositório dentro de 30 dias após a recuperação.

---

## 7. Treinamento e simulação

- Tabletop exercise anual com cenário sintético (sem dados reais).
- Revisão deste documento após cada exercício ou incidente real.
