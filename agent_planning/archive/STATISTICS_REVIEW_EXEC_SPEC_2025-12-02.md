# Statistics Review Engineering Execution Spec

**Date:** 2025-12-02
**Reviewer:** Claude Code (Opus 4.5)
**Status:** In Progress

## Executive Summary

Comprehensive review of `/dashboard/statistics` page against first principles, engineering guidelines (DOCS/GUIDELINES-REF), and lottery statistics best practices from academic research.

## Critical Issues Identified

### P0 - Rule Violations

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| Emoji usage | `page.tsx:532-560` | Violates CLAUDE.md "Never use emojis" | Replace with CSS styling |

### P1 - Mathematical Errors

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| Average delay formula incorrect | `delay-analysis.ts:77-81` | Misleading delay statistics | Use correct spacing formula |

### P2 - Statistical Misleading

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| Prize correlation implies causation | `prize-correlation.ts` | Users may believe numbers affect prizes | Add disclaimer |
| Hot/cold numbers (Gambler's Fallacy) | `streak-analysis.ts` | Independent events treated as dependent | Add disclaimer |

### P3 - Code Quality

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| Inconsistent rounding | Multiple files | Precision drift | Use `roundTo()` consistently |

## Detailed Analysis

### 1. Emoji Violation (P0)

**Current Code:**
```tsx
// page.tsx:532-534
{number.isHot && <span className="text-orange-400 mr-1">hot emoji</span>}
{number.isCold && <span className="text-blue-400 mr-1">cold emoji</span>}
```

**Problem:** CLAUDE.md explicitly states "Never use emojis!" in code.

**Solution:** Replace emojis with CSS-based visual indicators (gradient badges or colored dots).

---

### 2. Average Delay Formula (P1)

**Current Code (delay-analysis.ts:77-81):**
```typescript
const averageDelay = totalOccurrences > 1
  ? (latestContest - 1) / totalOccurrences
  : totalOccurrences === 1
    ? latestContest
    : latestContest;
```

**Problem:** This formula is mathematically incorrect.

**Mathematical Proof:**
- If number X appeared in contests: 10, 50, 100, 200 (4 times)
- Current formula: (200 - 1) / 4 = 49.75 (WRONG)
- Correct "average spacing": (200 - 10) / (4 - 1) = 63.33
- Or simply: totalDraws / frequency = expected spacing

**Correct Formula:**
```typescript
const averageDelay = totalOccurrences > 1
  ? (latestContest - firstContest) / (totalOccurrences - 1)
  : latestContest;
```

This represents the average gap between consecutive appearances.

---

### 3. Pair Correlation Formula Review

**Current Code (pair-analysis.ts:99-104):**
```typescript
const prob1 = freq1 / (totalDraws * 6);
const prob2 = freq2 / (totalDraws * 6);
const expectedFrequency = prob1 * prob2 * totalDraws * 15;
```

**Analysis:** This assumes independence and uses binomial approximation. For lottery numbers drawn WITHOUT replacement, the exact formula would use hypergeometric distribution. However, for large sample sizes (2900+ draws), this approximation is acceptable for descriptive purposes.

**Recommendation:** Add comment explaining the approximation and why it's valid for this use case.

---

### 4. Prize Correlation Misleading Statistics (P2)

**Current Code (prize-correlation.ts:107-111):**
```typescript
correlationScore: parseFloat(avgPrize.toFixed(2)) / (stats.avgSena || 1),
```

**Problem:** Prize amounts depend on:
1. Jackpot accumulation (how many draws without winner)
2. Number of winners (more winners = smaller individual prize)

Neither factor is related to WHICH numbers were drawn. The "lucky numbers" concept is statistically meaningless.

**Solution:** Add UI disclaimer explaining that prize correlation does not indicate causality.

---

### 5. Hot/Cold Numbers Analysis (P2)

**Research Findings:**
- Chi-square tests confirm lottery randomness ([Source](https://pickitz.ai/articles/frequency-analysis.html))
- Each draw is independent; past results don't affect future odds
- Frequency variations fall within normal statistical ranges

**Current Implementation:** The code correctly calculates frequencies but the interpretation ("hot" = will appear more) is Gambler's Fallacy.

**Solution:** Add prominent disclaimer that hot/cold is historical observation only, not prediction.

---

## Execution Plan

### Phase 1: Fix Emoji Violation (5 min)

1. Read `page.tsx` lines 530-560
2. Replace emoji spans with CSS gradient badges
3. Verify rendering

### Phase 2: Fix Delay Formula (10 min)

1. Update `delay-analysis.ts` formula
2. Add `firstContest` tracking to query
3. Update tests

### Phase 3: Add Statistical Disclaimers (15 min)

1. Create reusable `StatisticalDisclaimer` component
2. Add to hot/cold numbers section
3. Add to prize correlation section

### Phase 4: Standardize Rounding (5 min)

1. Search for `Math.round.*100.*100` pattern
2. Replace with `roundTo()` from `lib/utils.ts`

### Phase 5: Write Tests (20 min)

1. Test delay calculation edge cases
2. Test pair correlation formula
3. Test rounding consistency

## Verification Checklist

- [ ] No emojis in codebase
- [ ] Average delay formula mathematically correct
- [ ] Statistical disclaimers visible
- [ ] Rounding uses `roundTo()` consistently
- [ ] All tests pass
- [ ] Lint passes
- [ ] Build succeeds

## References

- [Lottery Number Frequency Analysis - Pickitz](https://pickitz.ai/articles/frequency-analysis.html)
- [Chi-square and the Lottery (PDF)](https://lstats0.tripod.com/_TheLottery.pdf)
- [A Statistical Analysis of Popular Lottery Strategies](https://csbigs.fr/index.php/csbigs/article/view/289/270)
- [Joe, H. (1993) "Tests of uniformity for sets of lotto numbers" Statist. Probab. Lett.](https://www.researchgate.net/publication/227644448_X2_and_the_lottery)
