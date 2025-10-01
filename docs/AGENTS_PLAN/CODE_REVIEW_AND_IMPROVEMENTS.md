# Code Review & Improvement Plan
**Date:** October 1, 2025  
**Reviewer:** Fresh Eyes Review  
**Scope:** Complete codebase audit for bugs, errors, and improvements

---

## 🔴 Critical Issues

### 1. **Migration 003 Schema Mismatch**
**File:** `db/migrations/003_pair_frequency_cache.sql`  
**Severity:** HIGH

**Problem:**
- Migration defines columns: `number_1`, `number_2`, `last_occurred_contest`, `last_occurred_date`
- PairAnalysisEngine expects columns: `number_a`, `number_b`, `correlation` (from initial plan)
- Code in `pair-analysis.ts` uses `number_1`, `number_2` but migration was updated
- Missing `correlation` column that was in original spec

**Impact:** PairAnalysisEngine will work but original design included correlation caching

**Fix:**
```sql
-- Need to update migration to include correlation column
ALTER TABLE number_pair_frequency ADD COLUMN correlation REAL DEFAULT 0.0;
CREATE INDEX idx_pair_correlation ON number_pair_frequency(correlation DESC);
```

**Code Location:** Lines 1-15 in `db/migrations/003_pair_frequency_cache.sql`

---

### 2. **BetGenerator Fibonacci Logic Bug**
**File:** `lib/analytics/bet-generator.ts`  
**Severity:** MEDIUM

**Problem:**
Lines 354-389 contain flawed logic:
```typescript
while (selected.size < count && fibonacci.length > 0) {
  const idx = Math.floor(Math.random() * fibonacci.length);
  selected.add(fibonacci[idx]);
  
  // BUG: This condition will never be true since fibonacci.length is constant
  if (selected.size < count && fibonacci.length === selected.size) {
    const num = Math.floor(Math.random() * MEGASENA_CONSTANTS.MAX_NUMBER) + 1;
    selected.add(num);
  }
}
```

**Issue:** The condition `fibonacci.length === selected.size` checks the wrong comparison. Should check if we've exhausted fibonacci numbers.

**Fix:**
```typescript
private generateFibonacciNumbers(count: number): number[] {
  const fibonacci: number[] = [1, 2];
  
  while (fibonacci[fibonacci.length - 1] < MEGASENA_CONSTANTS.MAX_NUMBER) {
    const next = fibonacci[fibonacci.length - 1] + fibonacci[fibonacci.length - 2];
    if (next <= MEGASENA_CONSTANTS.MAX_NUMBER) {
      fibonacci.push(next);
    } else {
      break;
    }
  }

  const selected = new Set<number>();
  const maxAttempts = count * 10; // Prevent infinite loops
  let attempts = 0;
  
  // Fill with Fibonacci numbers first
  while (selected.size < Math.min(count, fibonacci.length) && attempts < maxAttempts) {
    const idx = Math.floor(Math.random() * fibonacci.length);
    selected.add(fibonacci[idx]);
    attempts++;
  }

  // Fill remaining with random if needed
  while (selected.size < count) {
    const num = Math.floor(Math.random() * MEGASENA_CONSTANTS.MAX_NUMBER) + 1;
    selected.add(num);
  }

  return Array.from(selected);
}
```

---

### 3. **DelayAnalysis Average Calculation Flaw**
**File:** `lib/analytics/delay-analysis.ts`  
**Severity:** MEDIUM

**Problem:** Line 59
```typescript
const averageDelay = totalOccurrences > 0 ? latestContest / totalOccurrences : latestContest;
```

**Issue:** This calculates "average contests between draws" not "average delay between occurrences". Should be calculating the mean time between appearances.

**Fix:**
```typescript
// More accurate: calculate actual spacing between occurrences
const averageDelay = totalOccurrences > 1 
  ? (latestContest - 1) / totalOccurrences  // -1 because first contest is #1
  : latestContest; // Never appeared or only once
```

---

### 4. **Race Condition in PairAnalysis Cache**
**File:** `lib/analytics/pair-analysis.ts`  
**Severity:** MEDIUM

**Problem:** Lines 101-112
```typescript
const cacheCount = (
  this.db.prepare('SELECT COUNT(*) as count FROM number_pair_frequency').get() as {
    count: number;
  }
).count;

if (cacheCount === 0) {
  // Cache is empty, populate it
  this.updatePairFrequencies();
}
```

**Issue:** In concurrent requests (multiple users), this creates a race condition where multiple processes might try to populate the cache simultaneously.

**Fix:**
```typescript
getNumberPairs(minOccurrences: number = 1): PairStats[] {
  // Try to acquire lock or use transaction
  try {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');
    
    const cacheCount = (
      this.db.prepare('SELECT COUNT(*) as count FROM number_pair_frequency').get() as {
        count: number;
      }
    ).count;

    if (cacheCount === 0) {
      this.updatePairFrequencies();
    }
    
    this.db.exec('COMMIT');
  } catch (error) {
    this.db.exec('ROLLBACK');
    throw error;
  }
  
  // Rest of the method...
}
```

---

## 🟡 Performance Issues

### 5. **N+1 Query Problem in Delay Analysis**
**File:** `lib/analytics/delay-analysis.ts`  
**Lines:** 29-56

**Problem:**
```typescript
for (let num = MEGASENA_CONSTANTS.MIN_NUMBER; num <= MEGASENA_CONSTANTS.MAX_NUMBER; num++) {
  for (let col = 1; col <= 6; col++) {
    const lastOccurrence = this.db.prepare(...).get(num);
    const count = this.db.prepare(...).get(num);
  }
}
```

**Impact:** 60 numbers × 6 columns × 2 queries = **720 database queries** per call

**Fix:** Use a single query with JOIN or aggregate:
```typescript
getNumberDelays(): DelayStats[] {
  const latestContest = (
    this.db.prepare('SELECT MAX(contest_number) as max FROM draws').get() as { max: number }
  ).max;

  // Single query to get all last occurrences and counts
  const query = `
    WITH number_stats AS (
      SELECT 
        n.num as number,
        MAX(d.contest_number) as last_contest,
        MAX(d.draw_date) as last_date,
        COUNT(*) as total_occurrences
      FROM (SELECT 1 as num UNION ALL SELECT 2 UNION ALL ... SELECT 60) n
      CROSS JOIN draws d
      WHERE n.num IN (d.number_1, d.number_2, d.number_3, d.number_4, d.number_5, d.number_6)
      GROUP BY n.num
    )
    SELECT * FROM number_stats
  `;
  
  // Process results...
}
```

**Alternative:** Cache results in `number_frequency` table with a `delay` column.

---

### 6. **Streak Analysis Inefficiency**
**File:** `lib/analytics/streak-analysis.ts`  
**Lines:** 50-82

**Problem:** Nested loop analyzing 60 numbers against all recent draws (600 iterations)

**Fix:** Invert the logic:
```typescript
getHotStreaks(): StreakStats[] {
  const recentDraws = this.db.prepare(...).all(this.windowSize);
  
  // Build frequency map in single pass
  const recentFrequency = new Map<number, { count: number; lastContest: number | null }>();
  
  for (const draw of recentDraws) {
    const numbers = [draw.number_1, draw.number_2, draw.number_3, draw.number_4, draw.number_5, draw.number_6];
    for (const num of numbers) {
      const existing = recentFrequency.get(num);
      if (existing) {
        existing.count++;
        if (!existing.lastContest || draw.contest_number > existing.lastContest) {
          existing.lastContest = draw.contest_number;
        }
      } else {
        recentFrequency.set(num, { count: 1, lastContest: draw.contest_number });
      }
    }
  }
  
  // Now iterate 60 numbers only once
  // ... rest of logic
}
```

---

### 7. **Prize Correlation Repeated Column Queries**
**File:** `lib/analytics/prize-correlation.ts`  
**Lines:** 30-65

**Problem:** Similar N+1 pattern (60 × 6 = 360 queries)

**Fix:** Use UNION ALL to combine column searches:
```typescript
getPrizeCorrelation(): PrizeCorrelation[] {
  const overallAvgSena = (
    this.db.prepare('SELECT AVG(prize_sena) as avg FROM draws WHERE prize_sena > 0').get() as { avg: number }
  ).avg || 0;

  const query = `
    WITH number_prizes AS (
      SELECT 
        number_1 as num, prize_sena, prize_quina, winners_sena, winners_quina
      FROM draws
      UNION ALL
      SELECT number_2, prize_sena, prize_quina, winners_sena, winners_quina FROM draws
      UNION ALL
      SELECT number_3, prize_sena, prize_quina, winners_sena, winners_quina FROM draws
      UNION ALL
      SELECT number_4, prize_sena, prize_quina, winners_sena, winners_quina FROM draws
      UNION ALL
      SELECT number_5, prize_sena, prize_quina, winners_sena, winners_quina FROM draws
      UNION ALL
      SELECT number_6, prize_sena, prize_quina, winners_sena, winners_quina FROM draws
    )
    SELECT 
      num as number,
      COUNT(*) as frequency,
      AVG(prize_sena) as avg_sena,
      AVG(prize_quina) as avg_quina,
      SUM(CASE WHEN winners_sena > 0 THEN 1 ELSE 0 END) as total_wins_sena,
      SUM(CASE WHEN winners_quina > 0 THEN 1 ELSE 0 END) as total_wins_quina
    FROM number_prizes
    GROUP BY num
    ORDER BY num
  `;
  
  // Process results...
}
```

---

## 🟠 Code Quality Issues

### 8. **Magic Numbers in Complexity Score**
**File:** `lib/analytics/complexity-score.ts`  
**Lines:** 18-19, 34-54

**Problem:**
```typescript
private expectedPrimeCount: number = 1.7;
private expectedSum: number = 183;
```

**Issue:** These "magic numbers" are hardcoded without explanation or derivation.

**Fix:**
```typescript
export class ComplexityScoreEngine {
  // 17 primes in 1-60 range, expected in 6-number draw: (17/60) * 6 ≈ 1.7
  private readonly EXPECTED_PRIME_COUNT: number = (PRIME_NUMBERS.length / 60) * 6;
  
  // Average of 1-60 is 30.5, expected sum of 6 numbers: 30.5 * 6 = 183
  private readonly EXPECTED_SUM: number = ((1 + 60) / 2) * 6;
  
  // Scoring weights
  private readonly SCORE_WEIGHTS = {
    CONSECUTIVE_PAIR: 10,
    PRIME_DEVIATION: 5,
    SUM_DEVIATION_UNIT: 10,
    DECADE_DIVERSITY_FULL: 20,
    DECADE_DIVERSITY_PARTIAL: 10,
    PARITY_DEVIATION: 3,
  } as const;
  
  // ... use SCORE_WEIGHTS throughout
}
```

---

### 9. **Missing Error Handling in API Routes**
**File:** `server.ts`  
**Lines:** 52-124, 126-161

**Problem:** Catch blocks log errors but don't provide specific error types or recovery hints

**Fix:**
```typescript
'/api/statistics': async (req) => {
  try {
    // ... existing code
  } catch (error) {
    console.error('Statistics API error:', error);
    
    // Provide more context
    const statusCode = error instanceof TypeError ? 400 : 500;
    const message = error instanceof Error 
      ? error.message 
      : 'Failed to fetch statistics data';
    
    return new Response(JSON.stringify({ 
      error: message,
      type: error?.constructor?.name || 'UnknownError',
      timestamp: new Date().toISOString(),
    }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

---

### 10. **Potential Division by Zero**
**File:** `lib/analytics/sum-analysis.ts`  
**Line:** 59

```typescript
const mean = sums.reduce((acc, val) => acc + val, 0) / sums.length;
```

**Issue:** If `draws.length` is 0, `sums.length` will be 0, causing `NaN`

**Fix:**
```typescript
getSumDistribution(): SumStats {
  const draws = this.db.prepare(...).all();
  
  if (draws.length === 0) {
    // Return default/empty stats
    return {
      distribution: [],
      mean: 0,
      median: 0,
      mode: 0,
      stdDev: 0,
      percentiles: { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
      minSum: 0,
      maxSum: 0,
      totalDraws: 0,
    };
  }
  
  // ... rest of logic
}
```

---

### 11. **Inconsistent Rounding**
**Files:** Multiple analytics modules

**Problem:** Some use `Math.round(x * 100) / 100`, others use `.toFixed(2)`, inconsistent precision

**Fix:** Create utility function:
```typescript
// lib/utils.ts
export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// Usage
correlation: roundTo(correlation),
streakIntensity: roundTo(streakIntensity),
```

---

## 🔵 Potential Bugs

### 12. **Server Action Environment Variable**
**File:** `app/dashboard/generator/actions.ts`  
**Line:** 19

```typescript
const apiPort = process.env.API_PORT ?? '3201';
```

**Problem:** Server Actions run in Next.js (Node) context but need to call Bun server. If `API_PORT` env var is not set, defaults to 3201, but Bun server might be running on different port.

**Fix:**
```typescript
const apiPort = process.env.API_PORT ?? process.env.NEXT_PUBLIC_API_PORT ?? '3201';
const apiHost = process.env.API_HOST ?? 'localhost';
const baseUrl = `http://${apiHost}:${apiPort}`;

// Add validation
try {
  const healthCheck = await fetch(`${baseUrl}/api/dashboard`, { 
    signal: AbortSignal.timeout(2000) 
  });
  if (!healthCheck.ok) {
    throw new Error('Bun server not responding');
  }
} catch (error) {
  throw new Error(
    'Cannot connect to Bun API server. ' +
    'Ensure server.ts is running with `bun run dev`'
  );
}
```

---

### 13. **Unsafe Type Assertions**
**File:** `lib/db.ts`  
**Lines:** Throughout

**Problem:** Heavy use of `as { count: number }` without runtime validation

**Example:** Line 112-113
```typescript
).count;
```

**Fix:** Add runtime type guards:
```typescript
function assertCountResult(value: unknown): { count: number } {
  if (
    typeof value === 'object' && 
    value !== null && 
    'count' in value && 
    typeof value.count === 'number'
  ) {
    return value as { count: number };
  }
  throw new TypeError('Expected { count: number }, got ' + typeof value);
}

// Usage
const totalDraws = assertCountResult(
  this.db.prepare('SELECT COUNT(*) as count FROM draws').get()
).count;
```

---

### 14. **Missing Input Validation in CaixaClient**
**File:** `lib/api/caixa-client.ts`  
**Line:** 32-42

**Problem:** No validation on `contestNumber` parameter

**Fix:**
```typescript
async fetchDraw(contestNumber?: number): Promise<MegaSenaDrawData> {
  if (contestNumber !== undefined) {
    if (!Number.isInteger(contestNumber) || contestNumber < 1) {
      throw new Error(`Invalid contest number: ${contestNumber}. Must be positive integer.`);
    }
  }
  
  // ... rest of method
}
```

---

## 🟢 Minor Improvements

### 15. **Deprecation Warnings Not Documented**
**File:** `lib/analytics/bet-generator.ts`  
**Lines:** 261-274

**Problem:** Methods marked `@deprecated` but no migration guide

**Fix:**
```typescript
/**
 * Legacy method - generates simple bets only
 * @deprecated Use generateOptimizedBets(budget, BET_GENERATION_MODE.SIMPLE_ONLY, strategy) instead
 * @example
 * // Old way:
 * generator.generateBets(100, 'balanced');
 * 
 * // New way:
 * generator.generateOptimizedBets(100, BET_GENERATION_MODE.SIMPLE_ONLY, 'balanced');
 */
```

---

### 16. **Console Logs in Production**
**File:** `server.ts`, `scripts/pull-draws.ts`, `lib/db.ts`

**Problem:** `console.log` statements will run in production

**Fix:**
```typescript
// lib/logger.ts
export const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string, error?: unknown) => {
    console.error(`[ERROR] ${msg}`, error);
  },
  debug: (msg: string) => {
    if (process.env.DEBUG === 'true') {
      console.debug(`[DEBUG] ${msg}`);
    }
  },
};

// Replace all console.log with logger.info/debug
```

---

### 17. **Missing Rate Limit on API Routes**
**File:** `server.ts`

**Problem:** No rate limiting on public API routes

**Fix:**
```typescript
// Add simple in-memory rate limiter
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  
  if (!entry || entry.resetAt < now) {
    rateLimiter.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (entry.count >= limit) {
    return false;
  }
  
  entry.count++;
  return true;
}

// In fetch handler
async fetch(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // ... rest of handler
}
```

---

### 18. **Hardcoded Port in Server**
**File:** `server.ts`  
**Line:** 208

```typescript
const PORT = Number(process.env.API_PORT) || 3201;
```

**Issue:** Should validate port range

**Fix:**
```typescript
const PORT = (() => {
  const port = Number(process.env.API_PORT) || 3201;
  if (port < 1024 || port > 65535) {
    throw new Error(`Invalid API_PORT: ${port}. Must be between 1024-65535.`);
  }
  return port;
})();
```

---

## 📋 TODO List

### Phase 1: Critical Fixes (Week 1)
- [ ] Fix migration 003 schema mismatch
- [ ] Fix Fibonacci generator logic bug
- [ ] Fix delay analysis average calculation
- [ ] Add transaction handling to pair analysis cache
- [ ] Add input validation to all API endpoints

### Phase 2: Performance Optimization (Week 2)
- [ ] Optimize delay analysis with single query
- [ ] Optimize streak analysis algorithm
- [ ] Optimize prize correlation with UNION query
- [ ] Add database indexes for new columns
- [ ] Implement caching layer for expensive calculations

### Phase 3: Code Quality (Week 3)
- [ ] Replace magic numbers with named constants
- [ ] Improve error handling across all modules
- [ ] Add type guards for database results
- [ ] Create utility functions for common operations
- [ ] Add JSDoc comments to all public APIs

### Phase 4: Production Readiness (Week 4)
- [ ] Replace console.log with proper logger
- [ ] Add rate limiting to API routes
- [ ] Add monitoring and health check endpoints
- [ ] Write integration tests for all analytics engines
- [ ] Document all API endpoints (OpenAPI/Swagger)
- [ ] Add graceful shutdown handling
- [ ] Implement database connection pooling

---

## 🎯 Recommended Testing Strategy

### Unit Tests Needed
```typescript
// tests/lib/analytics/bet-generator.test.ts
describe('BetGenerator - Fibonacci', () => {
  it('should generate correct count of numbers', () => {
    const generator = new BetGenerator();
    const numbers = generator['generateFibonacciNumbers'](6);
    expect(numbers.length).toBe(6);
  });
  
  it('should handle cases where fibonacci count < requested', () => {
    const generator = new BetGenerator();
    const numbers = generator['generateFibonacciNumbers'](20);
    expect(numbers.length).toBe(20);
    expect(new Set(numbers).size).toBe(20); // All unique
  });
});

// tests/lib/analytics/delay-analysis.test.ts
describe('DelayAnalysisEngine', () => {
  it('should calculate correct average delay', () => {
    // Mock database with known data
    // Assert averageDelay matches expected calculation
  });
});
```

### Integration Tests Needed
```typescript
// tests/api/statistics.spec.ts
describe('Statistics API', () => {
  it('should return all statistics with all flags', async () => {
    const response = await fetch('/api/statistics?delays=true&decades=true&pairs=true');
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('delays');
    expect(data).toHaveProperty('decades');
    expect(data).toHaveProperty('pairs');
  });
  
  it('should handle empty database gracefully', async () => {
    // Clear database, call API, should not throw
  });
});
```

---

## 📊 Priority Matrix

| Issue | Severity | Impact | Effort | Priority |
|-------|----------|--------|--------|----------|
| Migration Schema Mismatch | High | High | Low | **P0** |
| Fibonacci Logic Bug | Medium | Medium | Low | **P0** |
| N+1 Query Problems | High | High | Medium | **P1** |
| Race Condition in Cache | Medium | Medium | Medium | **P1** |
| Division by Zero | Medium | Low | Low | **P2** |
| Missing Rate Limiting | Low | High | Medium | **P2** |
| Console Logs in Production | Low | Low | Low | **P3** |

---

## 🔧 Immediate Action Items

1. **Run database migration check:**
   ```bash
   bun run db:migrate
   # Verify pair_frequency table schema
   ```

2. **Add tests for Fibonacci generator:**
   ```bash
   bun test tests/lib/bet-generator.test.ts
   ```

3. **Profile performance:**
   ```bash
   bun run dev
   # Call /api/statistics?delays=true and measure response time
   # Should be < 500ms, if slower, apply optimizations
   ```

4. **Review logs for errors:**
   ```bash
   grep -r "console.error" server.ts lib/
   # Identify production error patterns
   ```

---

## 📝 Notes

- **Database:** All analytics engines directly query SQLite. Consider adding a caching layer (Redis) for production.
- **Scalability:** Current design assumes single-instance deployment. For horizontal scaling, shared cache is needed.
- **Monitoring:** No observability yet. Recommend adding Sentry for error tracking and Prometheus for metrics.
- **Documentation:** API endpoints lack OpenAPI spec. Consider adding Swagger UI.

---

**Review Complete** ✅  
**Total Issues Found:** 18  
**Critical:** 4 | **Performance:** 3 | **Quality:** 5 | **Minor:** 6

