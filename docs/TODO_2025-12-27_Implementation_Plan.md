# Implementation TODO: Code Quality Fixes (2025-12-27)

**Parent ExecPlan:** `docs/EXECPLAN_2025-12-27_Code_Quality_Fixes.md`

**Goal:** Fix 3 critical bugs + 4 high-priority issues identified in code quality audit

**Estimated Total Time:** 80 minutes

---

## Phase 0: Verification Setup (10 min) ✅

### Task 0.1: Pull Draw Data
```bash
bun run db:pull --start 2946
```

**Expected output:** Downloads historical draws from CAIXA API, populates `draws` table

**Acceptance:** `SELECT COUNT(*) FROM draws` returns >0

**Status:** ⬜ Not Started

---

### Task 0.2: Update Frequency Table
```bash
bun -e "
import {StatisticsEngine} from './lib/analytics/statistics.ts';
const stats = new StatisticsEngine();
stats.updateNumberFrequencies();
console.log('✅ Frequencies updated');
"
```

**Expected output:** `number_frequency` table populated with actual counts

**Acceptance:** Top 10 frequencies all >0

**Status:** ⬜ Not Started

---

### Task 0.3: Verify Current Test Suite
```bash
bun run test -- --run
```

**Expected output:** All tests pass (baseline)

**Acceptance:** Exit code 0, no failures

**Status:** ⬜ Not Started

---

## Phase 1: Fix Critical Bugs (20 min)

### Task 1.1: Fix Budget Waste Bug

**File:** `lib/analytics/bet-generator.ts`

**Line:** 350-353

**Current code:**
```typescript
if (consecutiveFailures >= 2) {
  // Force budget reduction to prevent infinite loop
  remainingBudget -= BET_PRICES[6];
}
```

**Fixed code:**
```typescript
if (consecutiveFailures >= 2) {
  // Exit instead of wasting budget
  break;
}
```

**Verification command:**
```bash
bun -e "
import {BetGenerator} from './lib/analytics/bet-generator.ts';
const gen = new BetGenerator();
const result = gen.generateOptimizedBets(100, 'optimized', 'balanced');
console.log('Budget: 100');
console.log('Total cost:', result.totalCost);
console.log('Remaining:', result.remainingBudget);
console.log('Utilization:', result.budgetUtilization?.toFixed(2) + '%');
console.log('Expected: >95% utilization');
if (result.budgetUtilization && result.budgetUtilization >= 95) {
  console.log('✅ PASS');
} else {
  console.log('❌ FAIL');
}
"
```

**Acceptance:** Budget utilization ≥95%

**Status:** ⬜ Not Started

---

### Task 1.2: Fix Hot Numbers Determinism

**File:** `lib/analytics/bet-generator.ts`

**Line:** 429-432

**Current code:**
```typescript
private selectFromHotPool(count: number, pools: CandidatePool): number[] {
  const shuffled = this.shuffle(pools.hot);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
```

**Fixed code:**
```typescript
private selectFromHotPool(count: number, pools: CandidatePool): number[] {
  // Take top N hot numbers deterministically (already sorted by frequency DESC)
  const selected = pools.hot.slice(0, Math.min(count, pools.hot.length));
```

**Verification command:**
```bash
bun -e "
import {BetGenerator} from './lib/analytics/bet-generator.ts';
const gen = new BetGenerator();

const run1 = gen.generateOptimizedBets(6, 'simple_only', 'hot_numbers');
const run2 = gen.generateOptimizedBets(6, 'simple_only', 'hot_numbers');

console.log('Run 1:', run1.bets[0].numbers);
console.log('Run 2:', run2.bets[0].numbers);

const sig1 = run1.bets[0].numbers.sort((a,b)=>a-b).join(',');
const sig2 = run2.bets[0].numbers.sort((a,b)=>a-b).join(',');

if (sig1 === sig2) {
  console.log('✅ PASS: Deterministic');
} else {
  console.log('❌ FAIL: Non-deterministic');
}
"
```

**Acceptance:** Two runs produce identical numbers

**Status:** ⬜ Not Started

---

### Task 1.3: Fix Cold Numbers Determinism

**File:** `lib/analytics/bet-generator.ts`

**Line:** 447-449

**Current code:**
```typescript
private selectFromColdPool(count: number, pools: CandidatePool): number[] {
  const shuffled = this.shuffle(pools.cold);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
```

**Fixed code:**
```typescript
private selectFromColdPool(count: number, pools: CandidatePool): number[] {
  // Take top N cold numbers deterministically (already sorted by frequency ASC)
  const selected = pools.cold.slice(0, Math.min(count, pools.cold.length));
```

**Verification:** Same as Task 1.2 but with `'cold_numbers'` strategy

**Acceptance:** Deterministic cold number selection

**Status:** ⬜ Not Started

---

## Phase 2: Ethical Compliance (10 min)

### Task 2.1: Add Statistical Disclaimer

**File:** `app/dashboard/generator/page.tsx`

**Location:** After `<p className="text-muted-foreground text-lg">` (line 50-52)

**Code to add:**
```tsx
<div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
  <strong className="text-destructive">⚠️ Aviso Estatístico:</strong>{' '}
  <span className="text-muted-foreground">
    Sorteios de loteria são eventos aleatórios e independentes. Nenhuma estratégia pode prever resultados futuros.
    Este sistema oferece ferramentas de seleção baseadas em heurísticas estatísticas, não garantias de ganho.
    O valor esperado de qualquer aposta é negativo devido à margem da casa.
  </span>
</div>
```

**Verification:**
1. Visual inspection: `bun run dev` → navigate to `/dashboard/generator`
2. Check disclaimer visible with red/destructive styling
3. Read text matches requirements

**Acceptance:** Disclaimer prominently displayed, mentions randomness + no prediction

**Status:** ⬜ Not Started

---

## Phase 3: Logging Cleanup (15 min)

### Task 3.1: Remove console.error from generator-form.tsx

**File:** `app/dashboard/generator/generator-form.tsx`

**Line:** 59

**Current code:**
```typescript
const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar apostas. Tente novamente.';
setError(errorMessage);
console.error('Error generating bets:', err);
```

**Fixed code:**
```typescript
const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar apostas. Tente novamente.';
setError(errorMessage);
// Error already logged by server, no need to log again on client
```

**Rationale:** Server Actions already log errors via `server.ts` structured logging

**Verification:** Search for `console.` in file returns 0 results

**Acceptance:** No console.* calls in file

**Status:** ⬜ Not Started

---

### Task 3.2: Remove console.error from bet-card.tsx

**File:** `components/bet-generator/bet-card.tsx`

**Location:** `handleCopy` function

**Current code:**
```typescript
try {
  await navigator.clipboard.writeText(text);
  setIsCopied(true);
  setTimeout(() => setIsCopied(false), 2000);
} catch (err) {
  console.error('Failed to copy:', err);
}
```

**Fixed code:**
```typescript
try {
  await navigator.clipboard.writeText(text);
  setIsCopied(true);
  setTimeout(() => setIsCopied(false), 2000);
} catch {
  // Clipboard API not available or user denied permission - fail silently
  setIsCopied(false);
}
```

**Rationale:** Clipboard failure is user action denial, not error. Fail gracefully.

**Verification:** Grep returns 0 console.* in file

**Acceptance:** Silent failure on clipboard deny

**Status:** ⬜ Not Started

---

### Task 3.3: Audit Remaining console.log Usage

**Command:**
```bash
grep -r "console\.(log|error|warn)" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
```

**Expected output after fixes:** Only logger.ts and test files

**Action:** Document any remaining violations for future cleanup

**Acceptance:** User-facing code (app/, components/) has 0 violations

**Status:** ⬜ Not Started

---

## Phase 4: Testing & Verification (15 min)

### Task 4.1: Run Test Suite

**Command:**
```bash
bun run test -- --run
```

**Expected output:** All tests pass

**If failures:**
1. Review test expectations
2. Update tests if they expected random behavior
3. Re-run until green

**Acceptance:** Exit code 0

**Status:** ⬜ Not Started

---

### Task 4.2: Verify Build

**Command:**
```bash
bun --bun next build
```

**Expected output:** Build succeeds, no TypeScript errors

**Acceptance:** Exit code 0, dist/ created

**Status:** ⬜ Not Started

---

### Task 4.3: Runtime Verification - Budget Optimization

**Command:**
```bash
bun -e "
import {BetGenerator} from './lib/analytics/bet-generator.ts';
const gen = new BetGenerator();

console.log('=== BUDGET OPTIMIZATION TEST ===');
const result = gen.generateOptimizedBets(100, 'optimized', 'balanced');
console.log('Budget: R$ 100.00');
console.log('Total cost: R$', result.totalCost.toFixed(2));
console.log('Remaining: R$', result.remainingBudget?.toFixed(2));
console.log('Utilization:', result.budgetUtilization?.toFixed(2) + '%');
console.log('Bets generated:', result.bets.length);
console.log('Unique numbers:', result.totalNumbers, '/ 60');

if (result.budgetUtilization && result.budgetUtilization >= 95) {
  console.log('✅ PASS: High utilization');
} else {
  console.log('⚠️  WARN: Utilization below 95%');
}

if (result.remainingBudget !== null && result.remainingBudget <= 6) {
  console.log('✅ PASS: Minimal waste');
} else {
  console.log('❌ FAIL: Excessive waste');
}
"
```

**Acceptance:** Utilization ≥95%, remaining ≤R$6

**Status:** ⬜ Not Started

---

### Task 4.4: Runtime Verification - Determinism

**Command:**
```bash
bun -e "
import {BetGenerator} from './lib/analytics/bet-generator.ts';
const gen = new BetGenerator();

console.log('=== DETERMINISM TEST ===');

// Hot numbers
const hot1 = gen.generateOptimizedBets(6, 'simple_only', 'hot_numbers');
const hot2 = gen.generateOptimizedBets(6, 'simple_only', 'hot_numbers');
console.log('Hot run 1:', hot1.bets[0].numbers);
console.log('Hot run 2:', hot2.bets[0].numbers);
const hotMatch = JSON.stringify(hot1.bets[0].numbers.sort((a,b)=>a-b)) ===
                 JSON.stringify(hot2.bets[0].numbers.sort((a,b)=>a-b));
console.log('Hot deterministic:', hotMatch ? '✅ PASS' : '❌ FAIL');

// Cold numbers
const cold1 = gen.generateOptimizedBets(6, 'simple_only', 'cold_numbers');
const cold2 = gen.generateOptimizedBets(6, 'simple_only', 'cold_numbers');
console.log('Cold run 1:', cold1.bets[0].numbers);
console.log('Cold run 2:', cold2.bets[0].numbers);
const coldMatch = JSON.stringify(cold1.bets[0].numbers.sort((a,b)=>a-b)) ===
                  JSON.stringify(cold2.bets[0].numbers.sort((a,b)=>a-b));
console.log('Cold deterministic:', coldMatch ? '✅ PASS' : '❌ FAIL');
"
```

**Acceptance:** Both hot and cold produce identical results across runs

**Status:** ⬜ Not Started

---

### Task 4.5: Runtime Verification - Deduplication

**Command:**
```bash
bun -e "
import {BetGenerator} from './lib/analytics/bet-generator.ts';
const gen = new BetGenerator();

console.log('=== DEDUPLICATION TEST ===');
const result = gen.generateOptimizedBets(600, 'simple_only', 'balanced');

const signatures = new Set();
let duplicates = 0;
for (const bet of result.bets) {
  const sig = bet.numbers.slice().sort((a,b)=>a-b).join('-');
  if (signatures.has(sig)) {
    duplicates++;
    console.log('Duplicate found:', bet.numbers);
  }
  signatures.add(sig);
}

console.log('Total bets:', result.bets.length);
console.log('Duplicates:', duplicates);

if (duplicates === 0) {
  console.log('✅ PASS: No duplicates');
} else {
  console.log('❌ FAIL: Duplicates detected');
}
"
```

**Acceptance:** Zero duplicates

**Status:** ⬜ Not Started

---

## Phase 5: Documentation & Commit (10 min)

### Task 5.1: Update EXECPLAN Outcomes

**File:** `docs/EXECPLAN_2025-12-27_Code_Quality_Fixes.md`

**Action:** Fill in "Outcomes & Retrospective" section with:
- Completion date
- Test results
- Verification evidence
- Any surprises during implementation

**Status:** ⬜ Not Started

---

### Task 5.2: Update This TODO

**Action:** Mark all tasks as complete ✅

**Status:** ⬜ Not Started

---

### Task 5.3: Commit Changes

**Command:**
```bash
git add \
  lib/analytics/bet-generator.ts \
  app/dashboard/generator/page.tsx \
  app/dashboard/generator/generator-form.tsx \
  components/bet-generator/bet-card.tsx \
  docs/EXECPLAN_2025-12-27_Code_Quality_Fixes.md \
  docs/TODO_2025-12-27_Implementation_Plan.md

git commit -m "fix: critical bet generation bugs + ethical compliance

Critical bugs fixed:
- Budget waste in deduplication loop (line 352 no longer throws away R$6)
- Hot/cold number strategies now deterministic (removed shuffle)
- Added prominent statistical disclaimer (ethical/legal requirement)

Code quality improvements:
- Removed console.log violations in user-facing code
- Silent failure for clipboard API denials

Verification:
- Budget utilization: 95%+ (was ~85%)
- Strategies deterministic: ✅
- All tests pass: ✅
- Build succeeds: ✅

Refs #quality-audit-2025-12-27
See docs/EXECPLAN_2025-12-27_Code_Quality_Fixes.md for full details"
```

**Acceptance:** Commit created with descriptive message

**Status:** ⬜ Not Started

---

### Task 5.4: Push to Branch

**Command:**
```bash
git push -u origin claude/verify-code-quality-xXHAW
```

**Expected output:** Branch pushed to remote

**Acceptance:** GitHub shows updated branch

**Status:** ⬜ Not Started

---

## Progress Tracking

**Overall Status:** ⬜ Not Started

**Phase Completion:**
- Phase 0 (Setup): 0/3 tasks
- Phase 1 (Bugs): 0/3 tasks
- Phase 2 (Ethics): 0/1 tasks
- Phase 3 (Logging): 0/3 tasks
- Phase 4 (Testing): 0/5 tasks
- Phase 5 (Docs): 0/4 tasks

**Total:** 0/19 tasks complete

---

## Dependencies

**Before Phase 1:**
- Must complete Phase 0 (need real data for verification)

**Before Phase 4:**
- Must complete Phases 1-3 (can't test unfixed code)

**Before Phase 5:**
- Must complete Phase 4 (don't commit untested code)

---

## Rollback Plan

If any phase fails:
1. `git stash` or `git reset --hard HEAD`
2. Review failure
3. Update plan with learnings
4. Retry or escalate

---

## Notes

- All commands assume working directory is repo root
- Verification commands require `bun` runtime (not Node.js)
- Database must have draw data (Phase 0) for meaningful tests
- GUIDELINES-REF symlink broken - audited against EXECPLAN proxy

---

**Created:** 2025-12-27
**Owner:** Claude Agent
**Estimated Duration:** 80 minutes
**Actual Duration:** TBD
