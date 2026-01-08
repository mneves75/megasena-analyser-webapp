# Capítulo 8: Testes com Vitest - Garantia de Qualidade

## Introdução

Testes são sua rede de segurança. Eles permitem refatorar com confiança, documentam comportamento esperado, e previnem regressões. Este capítulo ensina como testar o código deste projeto usando Vitest.

**Meta:** Cobertura de testes >= 80% (requisito do projeto)

---

## Por Que Vitest?

**Vantagens sobre Jest:**
- Native com TypeScript/Vite
- Modo watch extremamente rápido
- ESM nativo (sem transformações de módulo)
- Compatível com config do Vite
- Execução em paralelo por padrão

**Instalação:**
```bash
# Já incluído em devDependencies
bun add -D vitest @vitest/ui
```

---

## Configuração do Vitest

Abra `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node', // Server Components = ambiente Node
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'components/**/*.tsx'],
      exclude: ['node_modules/', 'tests/'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

---

## Comandos de Teste

Abra `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest --run",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Uso:**
```bash
bun run test              # Modo watch (re-roda em mudanças)
bun run test:run          # Executa uma vez e sai
bun run test:coverage     # Com relatório de cobertura
bun run test:ui           # Interface visual
```

---

## Estrutura de Testes

O projeto usa **espelhamento de estrutura**:

```
lib/
  analytics/
    statistics.ts          → tests/lib/analytics/statistics.test.ts
    bet-generator.ts       → tests/lib/analytics/bet-generator.test.ts
  constants.ts             → tests/lib/constants.test.ts
```

**Por que espelhamento:**
- Fácil encontrar testes para um arquivo
- Encoraja testes próximos ao código
- Reflete a estrutura do projeto

---

## Escrevendo Seu Primeiro Teste

Abra `tests/lib/constants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MEGASENA_CONSTANTS, BET_PRICES } from '@/lib/constants';

describe('MEGASENA_CONSTANTS', () => {
  it('deve ter MIN_NUMBER = 1', () => {
    expect(MEGASENA_CONSTANTS.MIN_NUMBER).toBe(1);
  });

  it('deve ter MAX_NUMBER = 60', () => {
    expect(MEGASENA_CONSTANTS.MAX_NUMBER).toBe(60);
  });

  it('deve ter NUMBERS_PER_BET = 6', () => {
    expect(MEGASENA_CONSTANTS.NUMBERS_PER_BET).toBe(6);
  });
});

describe('BET_PRICES', () => {
  it('deve ter preço de aposta simples = R$6', () => {
    expect(BET_PRICES[6]).toBe(6.0);
  });

  it('deve ter preço de aposta de 7 números = R$42', () => {
    expect(BET_PRICES[7]).toBe(42.0);
  });

  it('deve ter preço crescente com números', () => {
    for (let i = 6; i < 19; i++) {
      expect(BET_PRICES[i]).toBeLessThan(BET_PRICES[i + 1]);
    }
  });
});
```

---

## Testando Funções Puras

Funções puras (sem efeitos colaterais) são as mais fáceis de testar.

```typescript
// lib/utils/combinations.ts
export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;

  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}
```

```typescript
// tests/lib/utils/combinations.test.ts
import { describe, it, expect } from 'vitest';
import { combinations } from '@/lib/utils/combinations';

describe('combinations', () => {
  it('deve retornar 0 para k inválido', () => {
    expect(combinations(5, -1)).toBe(0);
    expect(combinations(5, 10)).toBe(0);
  });

  it('deve retornar 1 para casos base', () => {
    expect(combinations(5, 0)).toBe(1);
    expect(combinations(5, 5)).toBe(1);
  });

  it('deve calcular C(6,6) = 1', () => {
    expect(combinations(6, 6)).toBe(1);
  });

  it('deve calcular C(7,6) = 7', () => {
    expect(combinations(7, 6)).toBe(7);
  });

  it('deve calcular C(60,6) = 50063860', () => {
    expect(combinations(60, 6)).toBe(50063860);
  });
});
```

---

## Testando com Banco de Dados (Mock)

Testes de integração com banco usam banco de dados em memória.

Abra `tests/lib/analytics/statistics.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'bun:sqlite';
import { StatisticsEngine } from '@/lib/analytics/statistics';

describe('StatisticsEngine', () => {
  let db: Database;
  let engine: StatisticsEngine;

  beforeEach(() => {
    // Cria banco em memória para cada teste
    db = new Database(':memory:');
    setupTestDatabase(db);
    engine = new StatisticsEngine(db);
  });

  afterEach(() => {
    db.close();
  });

  function setupTestDatabase(database: Database) {
    database.exec(`
      CREATE TABLE draws (
        contest_number INTEGER PRIMARY KEY,
        draw_date TEXT NOT NULL,
        number_1 INTEGER NOT NULL,
        number_2 INTEGER NOT NULL,
        number_3 INTEGER NOT NULL,
        number_4 INTEGER NOT NULL,
        number_5 INTEGER NOT NULL,
        number_6 INTEGER NOT NULL
      );

      CREATE TABLE number_frequency (
        number INTEGER PRIMARY KEY,
        frequency INTEGER DEFAULT 0
      );

      INSERT INTO draws VALUES
        (1, '2024-01-01', 1, 2, 3, 4, 5, 6),
        (2, '2024-01-08', 2, 3, 4, 5, 6, 7),
        (3, '2024-01-15', 1, 2, 3, 4, 5, 6);
    `);
  }

  it('deve retornar número total de sorteios', () => {
    const stats = engine.getDrawStatistics();
    expect(stats.totalDraws).toBe(3);
  });

  it('deve calcular frequências corretamente', () => {
    engine.updateNumberFrequencies();
    const frequencies = engine.getNumberFrequencies();

    const num1 = frequencies.find(f => f.number === 1);
    expect(num1?.frequency).toBe(2); // Apareceu em 2 sorteios

    const num7 = frequencies.find(f => f.number === 7);
    expect(num7?.frequency).toBe(1); // Apareceu em 1 sorteio
  });
});
```

---

## Testando Gerador de Apostas

Abra `tests/lib/analytics/bet-generator.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'bun:sqlite';
import { BetGenerator } from '@/lib/analytics/bet-generator';

describe('BetGenerator', () => {
  let db: Database;
  let generator: BetGenerator;

  beforeEach(() => {
    db = new Database(':memory:');
    setupTestDatabase(db);
    generator = new BetGenerator(db);
  });

  it('deve gerar apostas simples para orçamento pequeno', () => {
    const result = generator.generateOptimizedBets(12, 'simple_only', 'random');

    expect(result.bets.length).toBeGreaterThan(0);
    expect(result.totalCost).toBeLessThanOrEqual(12);
    expect(result.bets[0].type).toBe('simple');
  });

  it('deve gerar aposta múltipla para orçamento grande', () => {
    const result = generator.generateOptimizedBets(200, 'multiple_only', 'random');

    expect(result.bets.length).toBe(1);
    expect(result.bets[0].type).toBe('multiple');
    expect(result.bets[0].numberCount).toBeGreaterThan(6);
  });

  it('não deve gerar apostas duplicadas', () => {
    const result = generator.generateOptimizedBets(60, 'simple_only', 'random');

    const signatures = new Set(
      result.bets.map(b => b.numbers.sort((a, b) => a - b).join('-'))
    );

    expect(signatures.size).toBe(result.bets.length);
  });

  it('deve lançar erro para orçamento insuficiente', () => {
    expect(() => {
      generator.generateOptimizedBets(5, 'optimized', 'random');
    }).toThrow('Orçamento insuficiente');
  });

  it('deve respeitar limite máximo de apostas', () => {
    const result = generator.generateOptimizedBets(100000, 'simple_only', 'random');

    expect(result.bets.length).toBeLessThanOrEqual(200);
  });
});
```

---

## Testes de Snapshot

Useful for UI components and complex outputs.

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardStats } from '@/components/dashboard-stats';

describe('DashboardStats Snapshot', () => {
  it('deve fazer match com snapshot', () => {
    const props = {
      totalDraws: 3000,
      lastDrawDate: '2024-01-15',
      mostFrequent: [{ number: 10, frequency: 287 }],
    };

    const { container } = render(<DashboardStats {...props} />);

    expect(container).toMatchSnapshot();
  });
});
```

---

## Testes Parametrizados

Execute o mesmo teste com diferentes entradas.

```typescript
import { describe, it, expect } from 'vitest';
import { BET_PRICES } from '@/lib/constants';

describe('BET_PRICES - Validação de preços', () => {
  const testCases = [
    [6, 6.0],
    [7, 42.0],
    [8, 168.0],
    [9, 504.0],
    [10, 1260.0],
  ];

  it.each(testCases)('deve ter preço correto para %d números', (numbers, expectedPrice) => {
    expect(BET_PRICES[numbers]).toBe(expectedPrice);
  });

  it.each(testCases)('preço de %d números deve ser múltiplo de 6', (numbers) => {
    expect(BET_PRICES[numbers]! % 6).toBe(0);
  });
});
```

---

## Mocks e Spies

Teste código que depende de serviços externos.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { CaixaClient } from '@/lib/api/caixa-client';

describe('CaixaClient', () => {
  it('deve fazer fetch com retry em erro', async () => {
    // Mock do fetch global
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draws: [] }),
      } as Response);

    const client = new CaixaClient();
    const result = await client.fetchDraws(2946);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ draws: [] });
  });

  it('deve respeitar backoff exponencial', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn().mockRejectedValue(new Error('Error'));

    global.fetch = fetchSpy;

    const client = new CaixaClient();
    const promise = client.fetchDraws(2946);

    // Avança tempo: 1s, 2s, 4s
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    vi.advanceTimersByTime(2000);
    await vi.runAllTimersAsync();

    vi.advanceTimersByTime(4000);
    await vi.runAllTimersAsync();

    expect(fetchSpy).toHaveBeenCalledTimes(5); // Inicial + 4 retries

    vi.useRealTimers();
  });
});
```

---

## Cobertura de Testes

**Verificar cobertura:**
```bash
bun run test:coverage
```

**Saída:**
```
 % Coverage report from v8
--------------------|---------|---------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|---------|---------|---------|
 All files           |   85.23 |   82.14 |   88.45 |   85.12 |
 lib                 |   92.15 |   89.23 |   94.12 |   92.05 |
  analytics          |   95.67 |   93.45 |   97.22 |   95.89 |
   bet-generator.ts  |   97.12 |   95.34 |  100.00 |   97.12 |
   statistics.ts     |   94.23 |   91.67 |   94.44 |   94.23
--------------------|---------|---------|---------|---------|
```

**Thresholds configurados:**
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

---

## Exercício 8.1: Testar Fisher-Yates

**Tarefa:** Escreva testes para a função de shuffle.

```typescript
// tests/lib/algorithms/shuffle.test.ts
import { describe, it, expect } from 'vitest';
import { BetGenerator } from '@/lib/analytics/bet-generator';

describe('Fisher-Yates Shuffle', () => {
  let generator: BetGenerator;

  beforeEach(() => {
    generator = new BetGenerator();
  });

  it('deve retornar array do mesmo tamanho', () => {
    const input = [1, 2, 3, 4, 5];
    const output = generator['shuffle'](input);

    expect(output).toHaveLength(input.length);
  });

  it('deve conter os mesmos elementos', () => {
    const input = [1, 2, 3, 4, 5];
    const output = generator['shuffle'](input);

    expect(output.sort()).toEqual(input.sort());
  });

  // TODO: Adicione mais testes:
  // 1. Não deve modificar o array original
  // 2. Deve produzir distribuição uniforme (teste estatístico)
});
```

<details>
<summary>Solução Completa</summary>

```typescript
describe('Fisher-Yates Shuffle', () => {
  let generator: BetGenerator;

  beforeEach(() => {
    generator = new BetGenerator();
  });

  it('deve retornar array do mesmo tamanho', () => {
    const input = [1, 2, 3, 4, 5];
    const output = generator['shuffle'](input);
    expect(output).toHaveLength(input.length);
  });

  it('deve conter os mesmos elementos', () => {
    const input = [1, 2, 3, 4, 5];
    const output = generator['shuffle'](input);
    expect(output.sort()).toEqual(input.sort());
  });

  it('não deve modificar o array original', () => {
    const input = [1, 2, 3, 4, 5];
    const original = [...input];
    generator['shuffle'](input);
    expect(input).toEqual(original);
  });

  it('deve produzir distribuição aproximadamente uniforme', () => {
    const input = [1, 2, 3];
    const iterations = 10000;
    const positionCounts: Record<number, number[]> = {
      0: [],
      1: [],
      2: [],
    };

    for (let i = 0; i < iterations; i++) {
      const shuffled = generator['shuffle']([...input]);
      shuffled.forEach((val, pos) => {
        positionCounts[pos].push(val);
      });
    }

    // Cada número deve aparecer em cada posição ~1/3 das vezes
    Object.values(positionCounts).forEach((counts) => {
      const count1 = counts.filter((x) => x === 1).length;
      const count2 = counts.filter((x) => x === 2).length;
      const count3 = counts.filter((x) => x === 3).length;

      // Permite variação de 5% (aproximadamente)
      expect(count1 / iterations).toBeCloseTo(0.333, 1);
      expect(count2 / iterations).toBeCloseTo(0.333, 1);
      expect(count3 / iterations).toBeCloseTo(0.333, 1);
    });
  });
});
```

</details>

---

## Exercício 8.2: Testar com Dados de Mock

**Tarefa:** Crie helper para criar mocks de dados de teste.

```typescript
// tests/helpers/mocks.ts
export interface MockDraw {
  contest_number: number;
  draw_date: string;
  numbers: number[];
}

export class MockDatabase {
  private db: Database;

  constructor() {
    this.db = new Database(':memory:');
    this.setupSchema();
  }

  private setupSchema() {
    // TODO: Criar schema de teste
    // - Tabela draws
    // - Tabela number_frequency
  }

  insertDraw(draw: MockDraw): void {
    // TODO: Inserir sorteio mockado
  }

  insertDraws(draws: MockDraw[]): void {
    // TODO: Inserir múltiplos sorteios
  }

  getDatabase(): Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

// Uso em teste
const mockDb = new MockDatabase();
mockDb.insertDraws([
  { contest_number: 1, draw_date: '2024-01-01', numbers: [1, 2, 3, 4, 5, 6] },
  { contest_number: 2, draw_date: '2024-01-08', numbers: [2, 3, 4, 5, 6, 7] },
]);

const engine = new StatisticsEngine(mockDb.getDatabase());
```

<details>
<summary>Solução</summary>

```typescript
// tests/helpers/mocks.ts
import Database from 'bun:sqlite';

export interface MockDraw {
  contest_number: number;
  draw_date: string;
  numbers: number[];
  prize_sena?: number;
  accumulated?: boolean;
}

export class MockDatabase {
  private db: Database;

  constructor() {
    this.db = new Database(':memory:');
    this.setupSchema();
  }

  private setupSchema() {
    this.db.exec(`
      CREATE TABLE draws (
        contest_number INTEGER PRIMARY KEY,
        draw_date TEXT NOT NULL,
        number_1 INTEGER NOT NULL,
        number_2 INTEGER NOT NULL,
        number_3 INTEGER NOT NULL,
        number_4 INTEGER NOT NULL,
        number_5 INTEGER NOT NULL,
        number_6 INTEGER NOT NULL,
        prize_sena REAL,
        accumulated INTEGER DEFAULT 0
      );

      CREATE TABLE number_frequency (
        number INTEGER PRIMARY KEY,
        frequency INTEGER DEFAULT 0,
        last_drawn_contest INTEGER,
        last_drawn_date TEXT
      );
    `);
  }

  insertDraw(draw: MockDraw): void {
    const stmt = this.db.prepare(`
      INSERT INTO draws (
        contest_number, draw_date,
        number_1, number_2, number_3, number_4, number_5, number_6,
        prize_sena, accumulated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      draw.contest_number,
      draw.draw_date,
      draw.numbers[0], draw.numbers[1], draw.numbers[2],
      draw.numbers[3], draw.numbers[4], draw.numbers[5],
      draw.prize_sena ?? 0,
      draw.accumulated ? 1 : 0
    );
  }

  insertDraws(draws: MockDraw[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO draws (
        contest_number, draw_date,
        number_1, number_2, number_3, number_4, number_5, number_6,
        prize_sena, accumulated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const draw of draws) {
      stmt.run(
        draw.contest_number,
        draw.draw_date,
        draw.numbers[0], draw.numbers[1], draw.numbers[2],
        draw.numbers[3], draw.numbers[4], draw.numbers[5],
        draw.prize_sena ?? 0,
        draw.accumulated ? 1 : 0
      );
    }
  }

  getDatabase(): Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
```

</details>

---

## Checklist de Testes

Antes de fazer commit, verifique:

- [ ] Todos os testes passam: `bun run test:run`
- [ ] Cobertura >= 80%: `bun run test:coverage`
- [ ] Sem warnings de TypeScript
- [ ] Testes de integração com mock DB funcionam
- [ ] Testes unitários de funções puras completos
- [ ] Testes de edge cases (valores inválidos, limites)

---

## Resumo do Capítulo 8

**Você aprendeu:**
- Por que Vitest sobre Jest
- Como configurar Vitest com TypeScript
- Estrutura de testes espelhada
- Testar funções puras
- Testar com banco de dados mockado
- Testes parametrizados e snapshots
- Mocks e spies para dependências externas
- Como medir e manter cobertura de testes

**Referências de código:**
- `vitest.config.ts` - Configuração
- `tests/lib/analytics/bet-generator.test.ts` - Testes de gerador
- `tests/lib/analytics/statistics.test.ts` - Testes de estatísticas
- `tests/helpers/mocks.ts` - Helpers de teste

**Insight chave:** Testes bem escritos documentam comportamento, previnem regressões, e permitem refatorar com confiança. Cobertura >= 80% é um bom proxy para saúde do código.

---

## Leitura Complementar

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Test-Driven Development](https://en.wikipedia.org/wiki/Test-driven_development)

---

## Conclusão do Tutorial

Parabéns! Você completou todos os 8 capítulos do tutorial de aprendizado do Mega-Sena Analyzer.

**O que você aprendeu:**
1. **Probabilidade e estatística** - Fundamentos matemáticos
2. **Combinatória** - A matemática por trás dos preços
3. **Estatística descritiva** - Análise de dados históricos
4. **Algoritmos** - Fisher-Yates, PD, MDC
5. **Banco de dados** - SQLite, transações, otimização
6. **Next.js/RSC** - Server Components e Server Actions
7. **Geração de apostas** - O sistema completo
8. **Testes** - Vitest e cobertura

**Próximos passos:**
- Explore o código base com seu novo conhecimento
- Contribua com melhorias
- Implemente novas estratégias de aposta
- Adicione mais testes

**Lembre-se:** A previsão de loteria é impossível. Este é um exercício técnico de análise estatística e algoritmos.

Boa sorte em sua jornada como desenvolvedor!
