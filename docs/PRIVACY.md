# Política de Privacidade

**Última atualização:** 20 de maio de 2026
**Versão:** 2.0 (revisão LGPD)

---

## Resumo

O Mega-Sena Analyzer coleta apenas o mínimo necessário para operar com segurança e disponibilidade. Não há cadastro, autenticação, cookies de marketing, analytics de terceiros nem perfilização. Identificadores técnicos como IP são pseudonimizados com HMAC-SHA256 antes de qualquer gravação.

Esta política foi escrita para cumprir a Lei nº 13.709/2018 (LGPD) e os entendimentos publicados pela Autoridade Nacional de Proteção de Dados (ANPD).

---

## 1. Quem é o controlador

| Item | Conteúdo |
|------|----------|
| Controlador | Equipe Mega-Sena Analyzer (projeto independente) |
| Encarregado (DPO) | Encarregado de Proteção de Dados — Mega-Sena Analyzer |
| Canal de privacidade | `privacidade@megasena-analyzer.com.br` |
| Endereço web | https://megasena-analyzer.com.br |

O canal `privacidade@megasena-analyzer.com.br` recebe todas as solicitações de titulares e da ANPD. Confirmamos recebimento em até 72 horas e respondemos em até 15 dias corridos.

---

## 2. Dados que NÃO coletamos

- Nome, e-mail, telefone ou qualquer dado de identificação direta
- CPF, RG ou documentos
- Dados financeiros ou de pagamento
- Dados sensíveis (origem racial/étnica, convicção religiosa, opinião política, dado de saúde, vida sexual, genético ou biométrico)
- Histórico de navegação para perfilização, publicidade ou analytics de marketing
- Cookies de rastreamento ou pixels de terceiros
- Dados de crianças ou adolescentes (o uso da plataforma é restrito a maiores de 18 anos por força dos Termos de Uso)

---

## 3. Dados armazenados localmente (no seu dispositivo)

Apenas dois valores funcionais ficam no `localStorage` do seu navegador:

| Chave | Conteúdo | Finalidade |
|-------|----------|------------|
| `megasena-theme` | `light` \| `dark` \| `system` | Memorizar a aparência escolhida |
| `megasena-privacy-ack` | Versão do aviso de privacidade (ex.: `2026-05-20`) | Lembrar que você já visualizou o aviso de privacidade para não exibi-lo novamente |

Esses dados ficam apenas no seu dispositivo, jamais são transmitidos ao servidor, e você pode apagá-los a qualquer momento limpando os dados do site no seu navegador. A aplicação **não usa cookies HTTP**, **não usa JWT**, **não usa MFA**, **não usa autenticação** — porque não há cadastro de usuário.

---

## 4. Dados operacionais processados no servidor

Para operar a API com segurança, gravamos telemetria técnica mínima:

| Campo | Conteúdo | Pseudonimização |
|-------|----------|------------------|
| Pseudônimo do cliente | HMAC-SHA256 do IP com salt rotativo (janela de 30 dias) | Sim — `IP_HASH_SECRET` é segredo do servidor; sem ele, o hash não é reversível por dicionário |
| User-agent | Texto truncado em 120 caracteres, sem caracteres de controle | Sim — sem parser de fingerprint |
| Rota, método HTTP, status, duração | Texto simples | Não aplicável |
| Identificador da requisição | UUID v4 gerado no servidor | Não correlaciona com identidade do titular |
| Metadata estruturada | Objeto JSON sanitizado recursivamente | Chaves sensíveis são redigidas |

Esses dados são usados para:

- Aplicar rate limiting (100 req/min por identificador pseudonimizado)
- Auditoria de eventos sensíveis (ex.: geração de aposta)
- Diagnóstico técnico e troubleshooting
- Continuidade e disponibilidade do serviço

**Base legal:** Art. 7º, IX da LGPD — legítimo interesse do controlador.

---

## 5. Retenção e eliminação

| Categoria | Retenção padrão |
|-----------|-----------------|
| Logs estruturados (`log_events`) | 30 dias |
| Auditoria (`audit_logs`) | 400 dias |
| Backups do banco | 7 dias rolantes |
| Rate limit em memória | Janela rolante de 60 segundos |

Retenção é executada por agendadores diários (`runLogRetention` / `runAuditRetention`). Você pode solicitar redução antecipada por meio do canal de privacidade.

---

## 6. Compartilhamento e operadores

Não vendemos, alugamos nem compartilhamos dados com terceiros para fins comerciais.

Operadores que processam dados em nosso nome:

| Operador | Função | Local | Salvaguarda |
|----------|--------|-------|-------------|
| Cloudflare, Inc. | CDN, mitigação de DDoS, terminação TLS | Edge global | Data Processing Addendum + cláusulas-padrão |
| Provedor de VPS | Hospedagem do servidor | Conforme contrato | Cláusulas-padrão do provedor |

A Cloudflare pode registrar metadados técnicos de tráfego de acordo com a própria política dela.

---

## 7. Transferência internacional (Art. 33 LGPD)

O tráfego é intermediado pela edge global da Cloudflare, o que pode envolver processamento fora do Brasil. A transferência ocorre apenas para entrega do serviço e está coberta por cláusulas-padrão de proteção de dados do operador. Detalhamento técnico está em `docs/LGPD-COMPLIANCE.md`, seção 9.

---

## 8. Seus direitos (Art. 18 LGPD)

Você tem direito a:

1. Confirmar a existência de tratamento dos seus dados
2. Acessar os dados que tratamos
3. Corrigir dados incompletos, inexatos ou desatualizados
4. Solicitar anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade
5. Solicitar a portabilidade dos seus dados em formato estruturado
6. Saber com quais entidades públicas e privadas houve compartilhamento
7. Apresentar petição contra o controlador perante a ANPD

Para exercer qualquer direito:

- Envie e-mail para `privacidade@megasena-analyzer.com.br`
- Descreva o que precisa (acesso, eliminação, portabilidade etc.)
- Inclua a janela temporal relevante (datas aproximadas) e, se possível, um `request-id` recebido nos cabeçalhos `X-Request-Id` das respostas

Confirmamos recebimento em até 72 horas e respondemos em até 15 dias corridos, conforme o Art. 19 da LGPD. Veja o passo a passo em [`/privacy/direitos`](https://megasena-analyzer.com.br/privacy/direitos).

---

## 9. Segurança

Aplicamos camadas técnicas e organizacionais para proteger os dados pseudonimizados:

- TLS obrigatório em produção (HSTS preload no edge)
- HMAC-SHA256 com salt rotativo para pseudonimizar IP
- CSP nonce-based em produção; CSP deny-by-default em respostas JSON da API
- Sanitização recursiva de metadados antes da gravação
- Rate limit por identificador pseudonimizado (100 req/min)
- Validação de input com Zod em todas as rotas mutáveis
- SQL parametrizado (sem concatenação)
- Cabeçalhos defensivos: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP/CORP
- Permissões `0640` no arquivo SQLite no servidor
- Auditoria periódica de segredos no histórico Git (`bun run security:secrets:history`)

Detalhamento técnico está em `docs/SECURITY.md` e `docs/LGPD-COMPLIANCE.md`.

---

## 10. Incidentes (Art. 48 LGPD)

Se identificarmos incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos a ANPD em prazo razoável e, quando aplicável, os titulares afetados. O processo está descrito em `docs/INCIDENT-RESPONSE.md`.

---

## 11. Crianças e adolescentes

O uso do Mega-Sena Analyzer é restrito a pessoas com 18 anos ou mais. Não direcionamos conteúdo para crianças nem coletamos intencionalmente dados de menores. Se identificarmos coleta inadvertida, eliminaremos os dados em prazo razoável após ciência.

---

## 12. Sobre a Plataforma

O Mega-Sena Analyzer é um projeto independente de análise estatística desenvolvido para fins educacionais. Não possui vínculo, patrocínio ou endosso da Caixa Econômica Federal ou de qualquer operador de loterias.

---

## 13. Reclamação à ANPD

Independentemente do nosso atendimento, você sempre pode apresentar reclamação à ANPD: https://www.gov.br/anpd/pt-br/canais_atendimento.

---

## 14. Mudanças nesta política

Esta política pode ser atualizada. A data da última revisão fica no topo do documento, e mudanças materiais serão anunciadas em `docs/LGPD-COMPLIANCE.md`.

---

## Perguntas frequentes

### O Mega-Sena Analyzer coleta meus dados pessoais?

Coletamos apenas telemetria técnica mínima: rota, método, status, duração, user-agent truncado, identificador da requisição e um pseudônimo HMAC do IP. Não coletamos cadastro, documentos, dados financeiros nem analytics de marketing.

### O Mega-Sena Analyzer usa cookies?

Não usamos cookies HTTP. Usamos apenas duas chaves no `localStorage` do seu navegador: `megasena-theme` (preferência de tema) e `megasena-privacy-ack` (versão do aviso de privacidade já visualizado).

### O Mega-Sena Analyzer tem login, JWT ou MFA?

Não. Não há cadastro nem autenticação. Sem login, sem token, sem MFA.

### Onde ficam armazenadas minhas apostas geradas?

As apostas geradas não são persistidas no navegador nem no servidor por padrão.

### O Mega-Sena Analyzer vende meus dados?

Não. Não vendemos, alugamos ou compartilhamos dados com terceiros para fins comerciais.

### Posso apagar meus dados?

Sim. Para dados no servidor, envie e-mail para `privacidade@megasena-analyzer.com.br`. Para dados no navegador, limpe os dados do site nas configurações do navegador.

### Quanto tempo guardamos os dados operacionais?

Logs estruturados: 30 dias. Auditoria: 400 dias. Backups: 7 dias rolantes.
