# Descoberta no ChatGPT Search

A versão 1.17.0 está publicada no domínio canônico com Worker/SQLite Durable Object. Staging permanece separado, com `X-Robots-Tag: noindex, nofollow` e robots bloqueando todos os caminhos. Os checks técnicos públicos foram repetidos após o corte; eles não comprovam visitas de crawlers reais, citações ou tráfego de leitores. A preferência de treinamento e a ausência de analytics de aquisição foram preservadas.

Verificação técnica em 02/10/2026. Público: leitores em pt-BR que consultam resultados oficiais da Mega-Sena, histórico, estatísticas descritivas e geração de apostas por orçamento. O site não prevê sorteios; cada concurso é independente. Dados oficiais vêm da CAIXA e são atualizados periodicamente.

## Superfície pública observada

| Página | HTTP | Canonical/robots | Conteúdo inicial |
| --- | --- | --- | --- |
| `/` | 200 | Próprio, index/follow | Apresentação, resultados e navegação |
| `/concurso/3065` | 200 | Próprio, index/follow | Dezenas, prêmios e análise do concurso |
| `/about` | 200 | Próprio, index/follow | Fonte, metodologia e limitações |
| `/numeros/10` | 200 | Próprio, index/follow | Frequência, atraso e pares |
| `/mega-da-virada` | 200 | Próprio, index/follow | Edições e regras, com fonte CAIXA |
| `/concurso/999999` | 404 | noindex; sem canonical | Controle ausente, fora do sitemap |

`/robots.txt`, `/sitemap.xml` e `/llms.txt` responderam 200. O sitemap tem 3.167 URLs, inclui o concurso 3065 e exclui o controle ausente. Páginas representativas têm links internos e JSON-LD que descreve conteúdo visível. Datas do sitemap vêm de alterações conhecidas nos dados/links, não da data da auditoria. O arquivo `llms.txt` é um guia opcional, não um requisito documentado de ranking.

## Crawlers e preferências

A política servida e a fonte permitem `/` para `User-Agent: *`, bloqueiam `/api/` e anunciam o sitemap. Esse grupo permite `OAI-SearchBot` e mantém a preferência atual para `GPTBot`; nenhuma política de treinamento foi alterada. `OAI-SearchBot` é o crawler de busca, `GPTBot` é relacionado a treinamento e `ChatGPT-User` atende visitas iniciadas por usuários. Essas funções são independentes. A propagação aproximada de 24 horas para alterações em robots não promete indexação nem citações. Consulte a [documentação oficial de crawlers](https://developers.openai.com/api/docs/bots), a [orientação de busca](https://help.openai.com/en/articles/9237897-chatgpt-search) e a [FAQ para publishers](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq), consultadas nesta data.

Requisições HTTP desta auditoria são diagnósticos sintéticos. Não comprovam acesso de IPs oficiais da OpenAI. A inspeção completa das políticas e dos eventos de crawlers permanece **BLOCKED** sem evidência verificável; os registros operacionais devem ficar privados. Não há evidência para desativar proteções. Após o aceite público e com acesso às políticas, confira eventos verificados de `OAI-SearchBot`, registrando somente horário, rota e resultado; não retenha identificadores de leitores nem queries brutas.

## Analytics e atribuição

O projeto possui estatísticas dos sorteios e telemetria operacional mínima, sem analytics de aquisição. Não registra referrer nem `utm_source`. Portanto, atribuição de tráfego ChatGPT fica **NOT MEASURED**, e registros históricos não podem ser reclassificados como visitas ChatGPT. Não foi criado rastreamento, cookie ou chave de localStorage.

Se futuramente houver um sistema de analytics aprovado, mapeie apenas `utm_source=chatgpt.com` à categoria explícita ChatGPT. Valores parecidos devem permanecer desconhecidos; UTMs não autenticam a origem. Preserve canonicals sem parâmetros, limpeza de campanhas, exclusão de crawlers e a política de privacidade. Teste somente numa base local, com controles para valores parecidos e crawlers. A mudança de coleta/finalidade exige sincronizar PRIVACY, LGPD-COMPLIANCE, textos públicos e divulgações de armazenamento aplicáveis. Consulte a [FAQ oficial sobre UTMs](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq).

## Baseline de citações

Cinco perguntas fixadas para medir descoberta, em pt-BR/Brasil:

1. Onde consultar o resultado e a premiação de cada concurso da Mega-Sena?
2. Como consultar a frequência e o atraso dos números da Mega-Sena?
3. Frequências históricas ajudam a prever o próximo sorteio da Mega-Sena?
4. Onde comparar os resultados históricos da Mega da Virada?
5. Como distribuir um orçamento entre apostas simples e múltiplas da Mega-Sena?

Execute cada pergunta três vezes em conversas novas do ChatGPT com Search ativado e memória desativada ou chat temporário, mantendo linguagem, região e configurações. São 15 respostas planejadas; **zero respostas do ChatGPT UI medidas nesta auditoria**. Resultados da API de busca ou de outros buscadores não substituem citações na interface do ChatGPT.

Guarde respostas, URLs citadas, erros e screenshots em evidência privada. Registre `checked_at,query_id,run,surface,search_enabled,language,region,brand_mentioned,domain_cited,cited_urls,artifact,status`. Calcule respostas completas citando o domínio / respostas completas, com erros/exclusões separados. Menção à marca não é citação. Compare a mesma amostra após publicação e um período de descoberta, por exemplo semanalmente durante quatro semanas; isso não é SLA nem agendamento automático. Tráfego, citações, acesso de crawler e elegibilidade são provas distintas.

## Estados desta auditoria

O candidato final foi publicado em staging (`v1.17.0-beta8`) e
produção (`v1.17.0`). O código da aplicação e o seed dessas versões foram
preservados durante a limpeza do histórico. Os checks públicos de versão/saúde
e CSP passaram após o deploy.
Essa publicação não comprova visita de crawler, citação no ChatGPT ou referral.

| Critério | Estado | Limite |
| --- | --- | --- |
| Implementação local e gates | PASS | CI do commit publicado: lint, ast-grep, tipos, cobertura, SQLite Bun, auditoria, standalone e builds/runtimes Worker; interação pública pelo Argent |
| Elegibilidade pública de descoberta | PASS | HTTP, HTML, canonical, robots, sitemap e controle 404 observados |
| Acesso genuíno de crawler OpenAI | BLOCKED | Sem configuração/eventos autenticados da borda |
| Citações observadas no ChatGPT Search | NOT MEASURED | Amostra planejada 5 × 3; nenhuma resposta UI medida |
| Atribuição e tráfego de leitores | NOT MEASURED | Sem analytics de aquisição; nenhum tráfego sintético enviado para provar atribuição |

A ingestão oficial foi corrigida para o endpoint `servicebus3` publicado pelo portal da CAIXA. Base local, seed e produção contêm 3.065 concursos, até 01/10/2026. A execução nativa do alarme remoto importou o concurso 3065 e persistiu o próximo ciclo diário. Uma execução bem-sucedida não garante disponibilidade futura: acompanhe os horários de tentativa/conclusão, estado de erro e concurso mais recente conforme DEPLOY.md.
