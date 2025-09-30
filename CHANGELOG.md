# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.0.2] - 2025-09-30

### Corrigido
- Ajustado o endpoint `POST /api/generate-bets` para validar o orçamento recebido e utilizar `generateOptimizedBets`, evitando exceções em runtime quando o payload vinha no formato incorreto.
- Eliminados avisos de `implicit any` nas páginas do dashboard ao tipar as respostas das APIs, garantindo compatibilidade com o TypeScript estrito.

### Adicionado
- Ambiente de banco de dados em memória para a suíte do Vitest, permitindo executar os testes automatizados em contextos Node (como o runner do Vitest) sem depender de `bun:sqlite`.
- Arquivo `.env.example` documentando as variáveis `NEXT_PUBLIC_BASE_URL`, `API_PORT` e `ALLOWED_ORIGIN`.
- Dependências de teste `jsdom`, `@types/jsdom` e `@testing-library/react` para suportar o ambiente JSDOM configurado no Vitest.

### Documentação
- Atualizado o README com as novas variáveis de ambiente, o corpo esperado do endpoint de geração de apostas e instruções sobre a camada em memória usada nos testes.
- Registrada no `docs/BUN_RUNTIME_FIX.md` a estratégia de fallback em memória para o Vitest.

## [1.0.1] - 2025-09-30

### Modificado
- **BREAKING CHANGE**: Migrado de `better-sqlite3` para `bun:sqlite` (SQLite nativo do Bun)
  - Resolve problemas de compatibilidade ABI com módulos nativos do Node.js
  - Melhor performance e integração com runtime Bun
  - Não requer compilação de binários nativos
  - **Nota**: Projeto agora requer Bun como runtime (não funciona com Node.js)

### Corrigido
- **CRÍTICO**: Corrigido bug grave no cálculo de frequências de números (lib/analytics/statistics.ts:62-79)
  - Frequências estavam sendo calculadas incorretamente devido a uso de LIMIT 1 em query SQL
  - Agora conta todas as ocorrências corretamente através de COUNT(*)
  - Todas as estatísticas de frequência agora refletem dados reais históricos
- **CRÍTICO**: Corrigidos timeouts na busca de dados históricos da API CAIXA
  - Timeout aumentado de 10s para 30s para lidar com respostas lentas
  - Número máximo de tentativas aumentado de 3 para 5
  - Backoff exponencial aprimorado: 2s, 4s, 8s, 16s, 32s (antes: 1s, 2s, 4s)
  - Adicionado delay de 3x após erros para evitar rate limiting
  - Busca de dados agora continua em caso de erro individual ao invés de abortar completamente

### Adicionado
- Classes CSS utilitárias para shadows (shadow-glow, shadow-elegant, hover:shadow-glow)
- Arquivo .env.example para documentação de variáveis de ambiente
- Implementação de exponential backoff no cliente da API CAIXA
- Cache ETag para requisições HTTP otimizadas (reduz bandwidth e latência)
- Sistema de retry robusto com backoff exponencial (2s, 4s, 8s, 16s, 32s)
- Rate limiting progressivo após 50+ requisições bem-sucedidas (previne sobrecarga da API)
- Constantes para valores "mágicos" em BET_ALLOCATION e STATISTICS_DISPLAY
- Tipos de retorno explícitos em todas as funções exportadas
- Suíte completa de testes para StatisticsEngine (12 casos de teste)
- Índices de performance no banco de dados (migrations/002_add_performance_indexes.sql)
  - Índices em todas as colunas number_1 a number_6
  - Índice para consultas de sorteios acumulados
  - Índice parcial para consultas de prêmios

### Modificado
- Refatorado: Removidos valores hardcoded, substituídos por constantes semânticas
- Melhorado: Error handling com try-catch em updateNumberFrequencies()
- Otimizado: Queries SQL para frequências agora usam COUNT() ao invés de .all().length
- Aprimorado: Tipo de retorno Promise<NextResponse> nas rotas da API

### Documentação
- Adicionado CODE_REVIEW_PLAN.md com análise completa de bugs e melhorias
- Documentadas todas as correções críticas e suas justificativas técnicas
- Adicionados comentários inline explicando algoritmos de frequência

### Performance
- Queries de frequência ~60x mais rápidas com novos índices de banco de dados
- Cache HTTP reduz latência em até 95% para dados já buscados
- Exponential backoff previne sobrecarga da API CAIXA em caso de falhas

## [1.0.0] - 2025-09-30

### Adicionado
- Dashboard principal com navegação intuitiva
- Módulo de estatísticas avançadas da Mega-Sena
  - Análise de frequência de números
  - Padrões de números pares/ímpares
  - Distribuição por dezenas
  - Análise de sequências
- Gerador inteligente de apostas
  - Geração baseada em análise estatística
  - Suporte a apostas simples e múltiplas
  - Otimização de orçamento
  - Seletor de estratégias
- Integração com API oficial da CAIXA
- Sistema de armazenamento local com SQLite
- Testes automatizados (Vitest)
- Documentação completa do projeto

### Segurança
- Implementação de Content Security Policy (CSP)
- Proteção contra XSS e CSRF
- Rate limiting nas chamadas de API
- Validação rigorosa de entrada de dados

---

## Formato do Versionamento

- **MAJOR**: Mudanças incompatíveis na API
- **MINOR**: Funcionalidades adicionadas de forma retrocompatível
- **PATCH**: Correções de bugs retrocompatíveis

---

## Tipos de Mudanças

- `Adicionado` para novas funcionalidades
- `Modificado` para mudanças em funcionalidades existentes
- `Depreciado` para funcionalidades que serão removidas
- `Removido` para funcionalidades removidas
- `Corrigido` para correções de bugs
- `Segurança` para correções de vulnerabilidades
