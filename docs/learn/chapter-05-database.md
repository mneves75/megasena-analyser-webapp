# Capítulo 5: Banco de Dados SQLite - Padrões e Otimização

## Introdução

SQLite é o banco de dados mais implantado no mundo - está no seu smartphone, no seu navegador, e em incontáveis aplicativos. Este capítulo explora como este projeto usa SQLite nativo do Bun para armazenar e consultar dados de loteria eficientemente.

Você aprenderá sobre transações, prepared statements, otimização de consultas e os padrões específicos do SQLite.

---

## Por Que SQLite?

**Vantagens:**
- Zero configuração: Sem servidor para configurar
- Arquivo único: Fácil backup e portabilidade
- Mode in-memory: Perfeito para testes
- SQL completo: JOINs, índices, transações
- Nativo no Bun: `bun:sqlite` - sem compilação

**Quando usar:**
- Aplicações de usuário único ou baixa concorrência
- Leitura pesada, escrita leve
- Prototipagem rápida
- Aplicativos embarcados

**Quando NÃO usar:**
- Alta concorrência de escrita (use PostgreSQL)
- Escala horizontal (use bancos distribuídos)
- Requisitos de consistência forte multi-região

---

## Conexão com Banco de Dados

Abra `lib/db.ts`:

```typescript
import Database from 'bun:sqlite';

const dbPath = import.meta.dir + '/../db/mega-sena.db';

export function getDatabase(): Database {
  const db = new Database(dbPath, { create: true });

  // Habilita WAL mode para melhor concorrência
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA synchronous = NORMAL');

  return db;
}
```

**O que cada PRAGMA faz:**
- `journal_mode = WAL`: Write-Ahead Logging - leituras não bloqueiam escritas
- `foreign_keys = ON`: Garante integridade referencial
- `synchronous = NORMAL`: Balanceia segurança e performance

---

## Schema do Banco de Dados

Abra `db/schema.ts`:

```typescript
// Tabela principal: sorteios
export const CREATE_DRAWS_TABLE = `
  CREATE TABLE IF NOT EXISTS draws (
    contest_number INTEGER PRIMARY KEY,
    draw_date TEXT NOT NULL,
    number_1 INTEGER NOT NULL,
    number_2 INTEGER NOT NULL,
    number_3 INTEGER NOT NULL,
    number_4 INTEGER NOT NULL,
    number_5 INTEGER NOT NULL,
    number_6 INTEGER NOT NULL,
    prize_sena REAL,
    prize_quina REAL,
    prize_quadra REAL,
    accumulated INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Tabela de frequências (view materializada)
export const CREATE_NUMBER_FREQUENCY_TABLE = `
  CREATE TABLE IF NOT EXISTS number_frequency (
    number INTEGER PRIMARY KEY,
    frequency INTEGER DEFAULT 0,
    last_drawn_contest INTEGER,
    last_drawn_date TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Índices para performance
export const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_draws_date ON draws(draw_date);',
  'CREATE INDEX IF NOT EXISTS idx_draws_contest ON draws(contest_number);',
];
```

**Por que índices:**
- Acelera queries filtrando por essas colunas
- `WHERE draw_date = ?` usa o índice
- `ORDER BY contest_number` usa o índice
- Trade-off: Mais armazenamento, inserts ligeiramente mais lentos

---

## Transações: Tudo ou Nada

Abra `lib/analytics/statistics.ts:63-129`:

```typescript
updateNumberFrequencies(): void {
  try {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');

    try {
      // ... múltiplas operações de update ...

      this.db.exec('COMMIT');
    } catch (innerError) {
      this.db.exec('ROLLBACK');
      throw innerError;
    }
  } catch (error) {
    throw new Error(`Failed to update number frequencies: ${error}`);
  }
}
```

**Por que transações são críticas:**

**Sem transação (perigoso):**
```typescript
// Se falhar aqui, dados ficam inconsistentes
resetStatement.run();

// Se falhar aqui, frequências estão zeradas!
for (let num = 1; num <= 60; num++) {
  updateStatement.run(/* ... */);
}
```

**Com transação (seguro):**
```typescript
BEGIN TRANSACTION;

// Se qualquer falhar, tudo é desfeito
resetStatement.run();
for (let num = 1; num <= 60; num++) {
  updateStatement.run(/* ... */);
}

COMMIT; // Só chega aqui se tudo deu certo
```

**Níveis de isolamento:**
- `BEGIN`: Adia bloqueios até primeira escrita
- `BEGIN IMMEDIATE`: Bloqueia banco imediatamente (útil para escritas)
- `BEGIN EXCLUSIVE`: Bloqueia até mesmo leituras (raramente necessário)

---

## Prepared Statements: SQL Injection

Abra `lib/analytics/statistics.ts:5-14`:

```typescript
// Queries pré-geradas (em tempo de compilação)
const NUMBER_COLUMN_COUNT_QUERIES = Array.from(
  { length: 6 },
  (_, i) => `SELECT COUNT(*) as count FROM draws WHERE number_${i + 1} = ?`
);

// Uso em runtime
for (let num = MEGASENA_CONSTANTS.MIN_NUMBER; num <= MEGASENA_CONSTANTS.MAX_NUMBER; num++) {
  const countStatement = countStatements[col];
  const countResult = countStatement.get(num);
  frequency += countResult?.count ?? 0;
}
```

**Por que prepared statements:**

**Vulnerável (concatenação de string):**
```typescript
const num = getUserInput();
const query = `SELECT * FROM draws WHERE number_1 = ${num}`;
// Se num = "1; DROP TABLE draws; --"
// Query se torna: SELECT * FROM draws WHERE number_1 = 1; DROP TABLE draws; --
```

**Seguro (prepared statement):**
```typescript
const query = `SELECT * FROM draws WHERE number_1 = ?`;
const result = db.prepare(query).get(userInput);
// O valor é tratado como dado, não código
```

**Benefícios adicionais:**
- Performance: Query é compilada uma vez, executada muitas vezes
- Type safety: SQLite valida tipos automaticamente
- Reutilizável: Mesmo prepared statement com diferentes valores

---

## O Padrão de View Materializada

Em vez de calcular frequências sob demanda (caro), mantemos uma tabela pré-computada.

**Abordagem On-Demand (lenta):**
```typescript
function getFrequencies(): NumberFrequency[] {
  const results: NumberFrequency[] = [];

  for (let num = 1; num <= 60; num++) {
    // Scan completo da tabela draws para cada número!
    const query = `
      SELECT COUNT(*) as count
      FROM draws
      WHERE number_1 = ? OR number_2 = ? OR ... OR number_6 = ?
    `;
    const count = db.prepare(query).get(num, num, ..., num);
    results.push({ number: num, frequency: count.count });
  }

  return results;
}
// Tempo: O(60 × rows) = O(rows) mas com 60 scans completos
```

**Abordagem Materializada (rápida):**
```typescript
function getFrequencies(): NumberFrequency[] {
  // Single query, retorna tudo
  const query = `SELECT * FROM number_frequency ORDER BY frequency DESC`;
  return db.prepare(query).all() as NumberFrequency[];
}
// Tempo: O(rows) mas com apenas 1 scan + índice
```

**Trade-off:**
- **Pró:** Consultas são instantâneas
- **Contra:** Precisa atualizar quando dados mudam
- **Decisão:** Leituras muito mais frequentes que escritas → vale a pena

---

## Otimização de Queries

### 1. EXPLAIN QUERY PLAN

SQLite pode explicar como ele executa uma query:

```bash
sqlite3 db/mega-sena.db "EXPLAIN QUERY PLAN SELECT * FROM draws WHERE number_1 = 10"
```

**Saída:**
```
SCAN TABLE draws  # Sem índice - scan completo (ruim)
```

**Adicionando índice:**
```sql
CREATE INDEX idx_number_1 ON draws(number_1);
```

**Nova saída:**
```
SEARCH TABLE draws USING INDEX idx_number_1 (number_1=?)  # Busca no índice (bom)
```

### 2. Covering Indexes

Índice que inclui todas as colunas da query:

```sql
-- Query: SELECT contest_number, draw_date FROM draws WHERE number_1 = ?
CREATE INDEX idx_covering ON draws(number_1, contest_number, draw_date);
```

SQLite pode satisfazer a query sem tocar na tabela principal!

### 3. Normalize vs Denormalize

**Schema normalizado:**
```sql
CREATE TABLE draws (contest_number PRIMARY KEY, draw_date TEXT);
CREATE TABLE draw_numbers (contest_number, number, PRIMARY KEY(contest_number, number));
```

**Schema desnormalizado (usado aqui):**
```sql
CREATE TABLE draws (
  contest_number PRIMARY KEY,
  draw_date TEXT,
  number_1 INTEGER, number_2 INTEGER, ..., number_6 INTEGER
);
```

**Por que desnormalizado:**
- Queries de análise são complexas no schema normalizado (muitos joins)
- Maioria das queries lê todos os 6 números de qualquer forma
- Armazenamento é barato, performance é cara

---

## Batch Operations: Inserção Eficiente

Abra `scripts/pull-draws.ts`:

```typescript
// Errado: Uma transação por insert
for (const draw of draws) {
  db.exec('BEGIN TRANSACTION');
  db.prepare('INSERT INTO draws VALUES (...)').run(draw);
  db.exec('COMMIT');
}
// Tempo: 1000 inserts = 1000 transações = MUITO lento

// Correto: Uma transação para todos inserts
db.exec('BEGIN TRANSACTION');
for (const draw of draws) {
  db.prepare('INSERT INTO draws VALUES (...)').run(draw);
}
db.exec('COMMIT');
// Tempo: 1000 inserts em 1 transação = MUITO mais rápido
```

**Por que tão mais rápido:**
- Sem commits, cada write vai para memória (WAL)
- Um único commit sincroniza tudo para disco
- SQLite pode otimizar layout em disco

---

## VACUUM: Recuperar Espaço

SQLite marca dados deletados como "livres" mas não reusa o espaço imediatamente.

```typescript
// scripts/optimize-db.ts
export function optimizeDatabase(): void {
  const db = getDatabase();

  // Rebuild do arquivo, removendo espaço livre
  db.exec('VACUUM');

  // Reconstrói índices
  db.exec('ANALYZE');

  // Força checkpoint do WAL
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
}
```

**Quando rodar:**
- Após grandes deleções
- Após alterações de schema
- Periodicamente (ex: mensalmente)

**Custo:** Bloqueia escritas durante a operação

---

## Backups e Restauração

Abra `scripts/backup-database.ts`:

```typescript
import { getDatabase } from '@/lib/db';

export function backupDatabase(backupPath: string): void {
  const db = getDatabase();

  // SQLite API de backup
  db.backup(backupPath)
    .then(() => console.log(`Backup salvo em ${backupPath}`))
    .catch((err) => console.error('Backup falhou:', err));
}
```

**Ou via shell:**
```bash
# Backup
cp db/mega-sena.db backups/mega-sena-$(date +%Y%m%d).db

# Restauração
cp backups/mega-sena-20250101.db db/mega-sena.db
```

---

## Exercício 5.1: Criar Tabela com Índices

**Tarefa:** Escreva uma função que cria uma tabela de usuários com índices apropriados.

```typescript
function createUserTable(db: Database): void {
  // TODO:
  // 1. Crie tabela 'users' com colunas: id, email, name, created_at
  // 2. id deve ser INTEGER PRIMARY KEY
  // 3. email deve ser UNIQUE (para prevenir duplicatas)
  // 4. Crie índice em 'email' (para queries de login)
  // 5. Crie índice em 'created_at' (para listagem ordenada)
}

// Teste
const db = getDatabase();
createUserTable(db);

// Verifique com:
// .schema users  (no shell sqlite3)
```

<details>
<summary>Solução</summary>

```typescript
function createUserTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
  `);
}
```

</details>

---

## Exercício 5.2: Transação com Rollback

**Tarefa:** Implemente uma função que transfere "saldo" entre contas, com rollback em erro.

```typescript
interface Account {
  id: number;
  balance: number;
}

function transfer(
  db: Database,
  fromId: number,
  toId: number,
  amount: number
): void {
  // TODO:
  // 1. Comece transação
  // 2. Verifique se 'from' tem saldo suficiente
  // 3. Debite de 'from'
  // 4. Adicione a 'to'
  // 5. Commit se tudo OK, rollback se erro
  // 6. Lance erro se saldo insuficiente
}
```

<details>
<summary>Solução</summary>

```typescript
function transfer(
  db: Database,
  fromId: number,
  toId: number,
  amount: number
): void {
  try {
    db.exec('BEGIN IMMEDIATE TRANSACTION');

    try {
      // Verifica saldo
      const fromAccount = db
        .prepare('SELECT balance FROM accounts WHERE id = ?')
        .get(fromId) as { balance: number } | undefined;

      if (!fromAccount) {
        throw new Error('Conta de origem não existe');
      }

      if (fromAccount.balance < amount) {
        throw new Error('Saldo insuficiente');
      }

      // Debita
      db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?')
        .run(amount, fromId);

      // Credita
      db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?')
        .run(amount, toId);

      db.exec('COMMIT');
    } catch (innerError) {
      db.exec('ROLLBACK');
      throw innerError;
    }
  } catch (error) {
    throw new Error(`Transferência falhou: ${error}`);
  }
}
```

</details>

---

## Exercício 5.3: Análise de Performance

**Tarefa:** Compare performance de query com e sem índice.

```typescript
// Crie tabela de teste
db.exec(`
  CREATE TABLE test (
    id INTEGER PRIMARY KEY,
    value INTEGER
  );
`);

// Insira 10.000 linhas
// ...

// Compare tempo de:
// 1. SELECT * FROM test WHERE value = 5000;
// 2. CREATE INDEX idx_value ON test(value);
// 3. SELECT * FROM test WHERE value = 5000;

console.time('query-sem-indice');
// ... query ...
console.timeEnd('query-sem-indice');

console.time('query-com-indice');
// ... query ...
console.timeEnd('query-com-indice');
```

**Esperado:** Query com índice deve ser significativamente mais rápida.

---

## Resumo do Capítulo 5

**Você aprendeu:**
- Por que SQLite é apropriado para este projeto
- Como estabelecer conexão e configurar PRAGMAs
- O schema de banco de dados e por que desnormalizado
- Transações ACID e por que são essenciais
- Prepared statements para segurança e performance
- O padrão de view materializada
- Otimização de queries com índices
- Operações em batch para inserts eficientes
- VACUUM e manutenção de banco

**Referências de código:**
- `lib/db.ts` - Conexão e configuração
- `db/schema.ts` - Schema do banco
- `lib/analytics/statistics.ts:63-129` - Transações em ação
- `scripts/optimize-db.ts` - VACUUM e manutenção

**Insight chave:** SQLite é poderoso quando usado corretamente. Transações e índices transformam um banco "lento" em um sistema de alta performance.

---

## Leitura Complementar

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [WAL Mode](https://www.sqlite.org/wal.html)
- [Query Planning](https://www.sqlite.org/queryplanner.html)
- [Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html)

---

**A seguir:** Capítulo 6 cobre Next.js e React Server Components - arquitetura moderna que reduz JavaScript enviado ao navegador.
