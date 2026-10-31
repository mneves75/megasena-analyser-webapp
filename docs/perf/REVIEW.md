# Revisão adversarial

Revisor: GPT-6.1 Sol, raciocínio alto, `codex exec -s read-only`, numa worktree limpa, sem
rede e sem dados de produção (só os agregados de `docs/perf/raw/`). O modelo que
implementou (Opus 5.5) não revisou o próprio trabalho. No máximo três rodadas.

## Rodada 1 — plano e W1 (`6aad51e`)

| # | Sev. | Achado | Disposição |
|---|---|---|---|
| 1 | alta | O W2 (revisão de draws com TTL de 60 s no cache local) viola o frescor: um arquivo em R enquanto a API serve R+1, e uma gravação atrasada de R pode estender o prazo. | **Aceito.** O W2 sai deste escopo (PLAN, "Estado após a revisão"). |
| 2 | alta | Excluir `/api/*` não zera escritas: num miss de cache, uma página com dados chama `DATA.handle()`, que grava auditoria e log. | **Aceito.** Documentado no PLAN. As medições em produção usam UA marcado e ritmo de 40/min; nenhuma escrita além das que um visitante comum geraria. |
| 3 | alta | PITR não é rollback sem perda para o W7. | **Aceito.** O W7 fica fora; o PLAN exige migração inversa. |
| 4 | alta | O comparador de pixels convertia para cinza (perdia diferenças de 1 nível num canal e de alpha) e sempre saía com 0. | **Corrigido** em `3f17c25`. `test_pixel_diff.py` falhava na mudança de 1 nível no azul. |
| 5 | média | A evidência do W1 não provava o comportamento servido: teste com mock, sessão de navegador compartilhada, bytes por preload e não por requisição real. | **Parcialmente corrigido.** Uma sessão por braço (`3f17c25`); code points por página contra os `unicode-range` servidos (BASELINE §4); requisições de fonte reais conferidas no log de rede do L3 do candidato (RESULTS). |
| 6 | média | 403, 503 ou página de desafio viravam amostras válidas. | **Corrigido** em `3f17c25` (`assertExpectedStatus`, com teste). |
| 7 | média | Numa divisão 100/0, o candidato chega ao DO do baseline; o harness não atesta qual versão atendeu. | **Aceito para o escopo.** O W1 não mexe no DO. A versão servida é atestada por `/api/health` e pelo `APP_VERSION` distinto na chave de cache. |
| 8 | média | Tempos sem controle de ordem, estado de cache, colo e revisão de dados. | **Aceito em parte.** Conexão nova intercalada A/B; modo warm alterna a ordem dos braços por rota; colo e cf-cache-status registrados por amostra (todos GIG). O A/A define o piso de ruído; nenhum p95 com n=30 é tratado como efeito. |
| 9 | média | O máximo amostrado não prova que trabalho legítimo cabe em 10 s de CPU (W4). | **Aceito.** O W4 fica fora até um teste com backlog de recuperação. |
| 10 | média | O W5 muda a 404 renderizada. | **Aceito.** O W5 fica fora. |
| 11 | média | As conclusões de custo excedem a evidência de billing. | **Aceito.** O PLAN §3 está marcado como condicional; RESULTS não declara economia. |

Também conferido e considerado correto pelo revisor: o cache ignora requisições com
cookie ou autenticação e rejeita `Set-Cookie`; queries e navegação do framework ignoram
o cache de HTML; a reescrita do nonce cobre headers e HTML/RSC; o W9 foi adiado com
razão.

## Rodada 2 — diff do release (`6aad51e..3f17c25`)

| # | Sev. | Achado | Disposição |
|---|---|---|---|
| 1 | P2 | O W1 reaproveita a identidade de cache do baseline: com `package.json` ainda em 1.19.2, `APP_VERSION` não muda e o HTML de arquivo em cache continua sendo o do renderizador antigo; uma medição do candidato mediria o baseline. | **Corrigido.** Versão 1.19.3 antes do build; `tests/scripts/release-version.test.ts` exige que `package.json` acompanhe a release mais nova do CHANGELOG (falhava com 1.19.2). |
| 2 | P2 | O arredondamento ao centavo podia aumentar o troco quando a API recebe frações de centavo: 47,999 em `multiple_only` dava 6 e somava 48. | **Corrigido.** O troco é truncado para centavos (com epsilon para restos binários) e nunca passa do que sobrou; teste com 47,999 falhava antes, controles 47,99, 48 e 100,30. |
| 3 | P2 | L3 e captura de pixels aceitavam amostra com fonte 403 ou script 500. | **Corrigido.** `assertRequiredAssetsLoaded` (scripts, CSS, fontes; julgado por URL) no L3 e na captura, que também lê cada `FontFace` com erro. Um smoke em produção mostrou que o Chromium lista o modulepreload deduplicado com status 0 ao lado do fetch real; a regra por URL cobre isso e tem teste. |

Também conferido e considerado correto: a pseudonimização nova reproduz a antiga em 216
comparações; o alarme registra erro estruturado sem causa nem stack e deixa escapar o erro
de infraestrutura; as regras de status; o escopo da exceção do minimatch (só ferramentas
de lint); o comparador de pixels por canal e a sessão separada por braço.

## Rodada 3 — correções da rodada 2 e aceitação de segurança (`bcf863d`)

Rodada final de revisão; o revisor também fez a aceitação de segurança do diff completo
(`36ad8cc..bcf863d`): nenhum achado Critical ou High, mas aceitação FAIL pelos três P2 abaixo.

| # | Sev. | Achado | Disposição |
|---|---|---|---|
| 1 | P2 | O epsilon fixo ainda promovia uma fração real: 47,999999999 em `multiple_only` dava troco 6 (soma 48). | **Corrigido.** `wholeCents` lê os centavos da forma decimal mais curta do número (o que o cliente enviou), sem `× 100`; testes de fronteira (47,999999999 e 47,9999999999999 → 5,99) e controles 6,1, 47,99, 48, 100,30. |
| 2 | P2 | Um 200 da mesma URL mascarava um 500 real; a captura descartava a query string (`?v=old` 200 escondia `?v=new` 500); o conjunto de sucessos aceitava outro tipo. | **Corrigido.** Falha HTTP explícita reprova sempre; status 0 ou ausente só é tolerado com sucesso do mesmo tipo e da mesma URL completa; a captura mantém a query. Os casos mistos falham na regra anterior e passam na nova. |
| 3 | P2 | BASELINE e PLAN publicavam contagens privadas de telemetria (RUM, uso da conta, tráfego, bloqueios, staging), vedadas pelo AGENTS.md. | **Corrigido.** Volumes, contagens e totais da conta saíram dos documentos públicos para a evidência privada do operador; ficam métricas por requisição e conclusões qualitativas. O commit `6aad51e` da branch já os continha; o merge no main é squash, para que esse commit não entre no histórico do main. |

O revisor também conferiu e considerou corretos: a versão chega a `APP_VERSION` e às
chaves de cache; a pseudonimização (75 comparações); agrupamento do rate limit, CSP/nonce
e isolamento do cache; o escopo do minimatch; gitleaks nos 12 commits do candidato; sem
identificadores de conta, endpoints workers.dev ou dados de linha nos arquivos.

Limite de três rodadas atingido. A aceitação de segurança das correções acima é feita por
uma verificação independente separada (mesmo modelo revisor, contexto novo), registrada
no gate de deploy.
