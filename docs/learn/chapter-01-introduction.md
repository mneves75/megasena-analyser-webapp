# Capítulo 1: Introdução ao Mega-Sena Analyzer

## Bem-vindo, Desenvolvedor Júnior

Você está prestes a embarcar em uma jornada por um dos codebases mais interessantes que você encontrará como desenvolvedor júnior. O Mega-Sena Analyzer não é apenas um aplicativo de loteria - é uma demonstração prática de estatística, combinatória, algoritmos, design de banco de dados e arquitetura web moderna trabalhando juntos.

Este tutorial usa a **Técnica de Feynman**: explicaremos conceitos como se estivéssemos ensinando uma criança brilhante de 12 anos, e depois adicionaremos profundidade técnica. Se você não consegue explicar um conceito simplesmente, você não o entende suficientemente bem.

---

## O Que Este Aplicativo Faz

Vamos começar com uma pergunta simples: **Podemos prever os próximos números da loteria?**

**Não. Absolutamente não.**

Aqui está o porquê, em termos simples: Imagine uma moeda perfeitamente justa. Você a joga 10 vezes e sai cara todas as vezes. Qual é a probabilidade de cara na 11ª jogada?

**Ainda 50%.**

A moeda não tem memória. Cada jogada é independente. O mesmo princípio se aplica às bolas da loteria - elas não se lembram dos números que saíram na semana passada.

Então o que este aplicativo realmente faz?

1. **Baixa dados históricos** da API oficial da CAIXA
2. **Armazena em um banco de dados** para consultas rápidas
3. **Analisa padrões** em sorteios históricos (frequência, sequências, distribuições)
4. **Gera estratégias de apostas** baseadas em estatística, não em previsão
5. **Otimiza o uso do orçamento** através de algoritmos matemáticos

**Distinção chave:** Analisamos o que **JÁ ACONTECEU**, não o que **VAI ACONTECER**.

---

## Visão Geral do Stack Tecnológico

Antes de mergulhar fundo, vamos orientá-lo com um mapa mental do codebase:

```
megasena-analyser-webapp/
├── app/                      # Next.js App Router (páginas, layouts)
├── components/               # Componentes UI reutilizáveis
├── lib/                      # Lógica de negócio (o cérebro do app)
│   ├── analytics/           # Motores estatísticos
│   ├── api/                 # Cliente da API CAIXA
│   ├── constants.ts         # Toda configuração
│   └── db.ts                # Conexão com banco de dados
├── db/                       # Banco SQLite e migrações
├── scripts/                  # Utilitários CLI (fetch de dados, ops DB)
└── tests/                    # Testes unitários espelhando lib/
```

**Escolhas Tecnológicas (Por Que Estas?):**

| Tecnologia | Por Que Usamos | Referência |
|------------|-----------------|-----------|
| **Next.js 16** | Server Components = menos JavaScript enviado ao navegador | `app/` |
| **Bun Runtime** | 28x mais rápido que npm, SQLite nativo, TypeScript embutido | `package.json` |
| **SQLite** | Zero configuração, arquivo único, perfeito para apps de leitura pesada | `db/mega-sena.db` |
| **TypeScript** | Pega bugs antes de rodar, melhor suporte de IDE | Todos arquivos `.ts` |
| **TailwindCSS v4** | CSS utility-first, sem troca de contexto | `app/globals.css` |

---

## Probabilidade Básica: O Fundamento

Vamos construir sua intuição para probabilidade. Isso é crucial para entender tudo que segue.

### Probabilidade vs Estatística

**Probabilidade** começa com um modelo conhecido e prevê resultados:
- "Um dado justo tem 6 lados. Probabilidade de tirar 3 é 1/6."

**Estatística** começa com dados observados e infere o modelo:
- "Jogamos este dado 1000 vezes e saiu 3 duzentas vezes. Este dado pode estar viciado."

Este app é **estatístico** - analisamos dados reais de sorteios para entender padrões.

### As Regras da Mega-Sena

Abra `lib/constants.ts:11-17`:

```typescript
export const MEGASENA_CONSTANTS = {
  MIN_NUMBER: 1,
  MAX_NUMBER: 60,
  NUMBERS_PER_BET: 6,
  MIN_NUMBERS_MULTIPLE: 6,
  MAX_NUMBERS_MULTIPLE: 20,
} as const;
```

**O que isso significa:**
- 60 bolas no total (numeradas 1-60)
- Cada sorteio seleciona 6 bolas únicas
- Jogadores podem escolher 6-20 números (mais números = exponencialmente mais caro)

### O Princípio Fundamental da Contagem

Se você tem 60 escolhas para a primeira bola, 59 para a segunda (sem repetições), 58 para a terceira...

Espere. Na verdade, **ordem não importa** na Mega-Sena. Sortear {1,2,3,4,5,6} é o mesmo que {6,5,4,3,2,1}.

Isso é um problema de **combinação**: C(n,k) = "n escolhe k"

**Fórmula:**
```
C(n,k) = n! / (k! * (n-k)!)
```

Para Mega-Sena: C(60,6) = 60! / (6! * 54!) = **50.063.860**

**50 milhões de combinações possíveis.**

É por isso que o prêmio da Sena é tão difícil de ganhar. Vamos abordar isso em detalhes no Capítulo 2.

---

## Tour pelo Código: constants.ts

Abra `lib/constants.ts` no seu editor. Este arquivo é a **única fonte de verdade** para todos os números mágicos na aplicação.

**Por que centralizar constantes?**

**Má prática:**
```typescript
// Espalhado pelo codebase
const price = 6.0;  // De onde veio isso? E se mudar?
```

**Boa prática (o que fazemos):**
```typescript
// lib/constants.ts
export const BET_PRICES: Record<number, number> = {
  6: 6.0,
  7: 42.0,
  // ...
};

// Uso em outros lugares
import { BET_PRICES } from '@/lib/constants';
const price = BET_PRICES[6];  // Claro, rastreável, fácil de atualizar
```

### Exercício 1.1: Exploração de Constantes

**Tarefa:** Responda estas perguntas lendo `lib/constants.ts`:

1. Qual é o custo de uma aposta múltipla de 15 números?
2. Qual endpoint da API o app usa para buscar dados?
3. Quantas apostas podem ser geradas em uma única operação?
4. Qual é o timeout para requisições da API?

<details>
<summary>Solução</summary>

1. `BET_PRICES[15]` = 30030.0 (R$30.030)
2. `API_CONFIG.CAIXA_BASE_URL` = "https://servicebus2.caixa.gov.br/portaldeloterias/api"
3. `BET_GENERATION_LIMITS.MAX_BETS_PER_GENERATION` = 200
4. `API_CONFIG.REQUEST_TIMEOUT` = 30000 (30 segundos)

</details>

---

## Fluxo de Dados: Da API ao Dashboard

Entender como os dados se movem pelo sistema é crítico. Vamos traçar um único sorteio:

```
CAIXA API
    ↓
scripts/pull-draws.ts (busca JSON)
    ↓
SQLite: db/mega-sena.db (armazena na tabela 'draws')
    ↓
lib/analytics/statistics.ts (consulta e analisa)
    ↓
app/dashboard/page.tsx (Server Component renderiza HTML)
    ↓
Navegador do usuário (recebe HTML final)
```

**Insight chave:** A maior parte do trabalho acontece **no servidor**. O navegador recebe HTML pré-renderizado com dados já incluídos.

---

## A Assunção de Independência

Este é o conceito estatístico mais importante para este app.

**Definição:** Dois eventos são independentes se a ocorrência de um não afeta a probabilidade do outro.

**Sorteios da loteria são independentes.**

Evidência: O código em `lib/analytics/statistics.ts:175-228` detecta padrões como números consecutivos e distribuições par/ímpar. Estes são **descritivos**, não **preditivos**.

Se o 10 apareceu nos últimos 5 sorteios, ele NÃO está "para sair" novamente (ou "para parar de sair"). Cada sorteio é independente.

---

## Filosofia do Projeto: O Que NÃO Fazemos

1. **Nós não "prevemos"** - Todas as apostas geradas são baseadas em estatística histórica
2. **Não garantimos vitórias** - O README afirma explicitamente que previsão é impossível
3. **Não hardcoded preços** - Todos valores são parametrizados para fácil atualização
4. **Não usamos dependências externas** - SQLite nativo do Bun, sem compilação

---

## O Caminho de Aprendizado

Aqui está sua jornada através deste codebase:

| Capítulo | Foco | Conceitos Chave |
|---------|-------|-----------------|
| 1 (aqui) | Introdução | Probabilidade, constantes, arquitetura |
| 2 | Combinatória | C(n,k), por que preços explodem exponencialmente |
| 3 | Estatística | Análise de frequência, detecção de padrões |
| 4 | Algoritmos | Fisher-Yates, programação dinâmica, MDC |
| 5 | Banco de Dados | SQLite, transações, prepared statements |
| 6 | Next.js/RSC | Server Components, Server Actions |
| 7 | Geração de Apostas | Otimização de orçamento, estratégias |
| 8 | Testes | Vitest, test doubles, cobertura |

---

## Exercício 1.2: Primeira Mudança no Código

**Tarefa:** Adicione um novo preset de orçamento à aplicação.

1. Abra `lib/constants.ts:78-80`
2. Adicione `25000` ao array `BUDGET_PRESETS`
3. Rode `bun run dev` e verifique que o novo preset aparece no gerador de apostas

**Por que isso importa:** Isso demonstra como uma mudança de única linha se propaga através da aplicação inteira sem tocar em outros arquivos.

---

## Exercício 1.3: Cálculo de Probabilidade

**Tarefa:** Calcule a probabilidade de ganhar cada faixa de prêmio.

Dados:
- Total de combinações: 50.063.860
- Sena (acertar 6): Precisa de todos os 6 números
- Quina (acertar 5): Precisa de exatamente 5 números
- Quadra (acertar 4): Precisa de exatamente 4 números

**Dica:** Use a fórmula de combinação C(n,k). Para Quina: C(6,5) * C(54,1) / C(60,6)

<details>
<summary>Solução</summary>

**Sena:** C(6,6) * C(54,0) / C(60,6) = 1 / 50.063.860 ≈ 0,000002%

**Quina:** C(6,5) * C(54,1) / C(60,6) = 6 * 54 / 50.063.860 = 324 / 50.063.860 ≈ 0,000647%

**Quadra:** C(6,4) * C(54,2) / C(60,6) = 15 * 1431 / 50.063.860 = 21.465 / 50.063.860 ≈ 0,0429%

</details>

---

## Resumo do Capítulo 1

**Você aprendeu:**
- O que o app faz (análise histórica, não previsão)
- O stack tecnológico e por que cada ferramenta foi escolhida
- Conceitos básicos de probabilidade (probabilidade vs estatística, independência)
- Como constantes centralizam configuração
- O fluxo de dados da API ao navegador

**Referências de código:**
- `lib/constants.ts:1-140` - Toda configuração
- `lib/analytics/statistics.ts:1-278` - Motor estatístico
- `scripts/pull-draws.ts` - Fetch de dados

**A seguir:** Capítulo 2 mergulha fundo em combinatória - a matemática que explica por que uma aposta de 20 números custa R$232.560.

---

## Leitura Complementar

- [Técnica de Feynman explicada](https://www.farnamstreetblog.com/richard-feynman-learning-technique/)
- [Matemática de loterias](https://en.wikipedia.org/wiki/Lottery_mathematics)
- [Falácia do apostador](https://en.wikipedia.org/wiki/Gambler%27s_fallacy) - Por que números "para sair" são um mito
