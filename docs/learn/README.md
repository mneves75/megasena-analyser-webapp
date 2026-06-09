# Trilha de Onboarding - Mega-Sena Analyzer

Bem-vindo. Esta pasta tem **duas trilhas** complementares para quem está começando:

- **Trilha do Sistema (esta):** como o software funciona — arquitetura, dados,
  subsistemas, operações e LGPD. Arquivos `01`–`10`.
- **Trilha de Matemática (existente):** a ciência por trás da loteria — combinatória,
  estatística, algoritmos. Arquivos `chapter-01-introduction.md` …
  `chapter-08-testing.md`.

Há também uma versão **interativa** desta trilha: abra `index.html` no navegador
(página única, sem servidor) com diagramas, glossário pesquisável e widgets ao vivo.

> Método: técnica de Feynman — primeiro em linguagem simples, depois o detalhe técnico,
> sempre com "Como verificar isso no código". A **fonte primária é o código**; docs são
> secundárias e foram verificadas contra os arquivos reais.

## Ordem de leitura recomendada

1. `01-system-overview.md` - o que o sistema faz e os dois processos de runtime.
2. `02-repository-map.md` - onde fica cada coisa.
3. `03-runtime-architecture.md` - processos, ciclo de requisição, fronteiras.
4. `04-data-flow.md` - fluxo de dados e o MER completo.
5. `05-core-subsystems.md` - cada subsistema e seus contratos.
6. `06-tech-stack-explained.md` - cada tecnologia, com onde aparece.
7. `07-operations-and-quality.md` - testes, build, deploy, observabilidade.
8. `08-exercises.md` - pratique por capítulo (compreensão → mudança).
9. `09-open-questions-and-risks.md` - o que não é certo e o que evitar.
10. `10-lgpd-compliance-plan.md` - verificação de LGPD e plano de conformidade.

Júnior com pressa? Leia `01`, `04` e `09` primeiro — dão o mapa, o modelo de dados e as
armadilhas.

## Visão geral em uma frase

O Mega-Sena Analyzer baixa sorteios oficiais da CAIXA para um **SQLite** local, calcula
estatísticas históricas com **engines em TypeScript** rodando num **servidor Bun**
(`server.ts`, porta 3201), e mostra tudo num app **Next.js 16** (porta 3000) que pede os
dados por HTTP. Ele **analisa o passado**; não prevê o futuro.

## Mapa rápido do código

| Quero entender... | Vá para |
| --- | --- |
| A API e a segurança | `server.ts`, `lib/security/*` |
| O banco e o schema | `lib/db.ts`, `db/migrations/*.sql` |
| As estatísticas | `lib/analytics/statistics.ts` e `lib/analytics/*` |
| O gerador de apostas | `lib/analytics/bet-generator.ts` |
| A ingestão de dados | `scripts/pull-draws.ts`, `lib/api/caixa-client.ts` |
| As páginas | `app/dashboard/*`, `app/layout.tsx` |
| CSP/headers | `proxy.ts`, `lib/security/csp.ts` |
| Deploy/operação | `scripts/start-*.ts`, `Dockerfile`, `.github/workflows/*` |

## Glossário

- **App Router:** modelo de rotas do Next.js (pasta `app/`), Server Components por
  padrão.
- **Server Component (RSC):** componente React que renderiza no servidor; sem estado de
  browser. O oposto é **Client Component** (`'use client'`).
- **Server Action:** função `'use server'` chamada do cliente para rodar no servidor
  (ex.: `app/dashboard/generator/actions.ts`).
- **Bun:** runtime JS/TS usado aqui; traz `bun:sqlite`. O app **não roda em Node**.
- **`bun:sqlite`:** cliente SQLite nativo do Bun (`lib/db.ts`).
- **MER:** Modelo Entidade-Relacionamento; ver `04-data-flow.md`.
- **Cache derivado:** tabela recomputada a partir de `draws` (`number_frequency`,
  `number_pair_frequency`).
- **CSP (Content-Security-Policy):** política que limita de onde scripts/estilos podem
  vir; aqui por **nonce** por requisição (`proxy.ts`, `lib/security/csp.ts`).
- **Nonce:** valor aleatório por requisição que autoriza um script inline específico.
- **Pseudonimização:** transformar dado pessoal (IP) em pseudônimo via HMAC-SHA256
  (`lib/security/pseudonymize.ts`); ainda é dado pessoal sob a LGPD.
- **Rate limiting:** limite de requisições por IP (100/min) em `server.ts`.
- **Standalone output:** build do Next que empacota o servidor para deploy
  (`next.config.js`, `dist/standalone`).
- **Aposta simples/múltipla:** 6 dezenas (simples) ou 7–20 (múltipla); preços em
  `lib/constants.ts`.
- **Hot/Cold numbers:** números mais/menos sorteados recentemente
  (`StreakAnalysisEngine`).
- **WAL:** Write-Ahead Logging do SQLite (PRAGMA em `lib/db.ts`).

## Convenções deste material

- pt-BR, sem emojis.
- Toda afirmação importante cita arquivo e símbolo.
- Cada capítulo separa **Verificado no código**, **Inferido do código** e
  **Conhecimento externo**.
- Onde há ambiguidade, explicamos a interpretação mais sustentada pelo código e
  registramos o resto em `09-open-questions-and-risks.md`.
