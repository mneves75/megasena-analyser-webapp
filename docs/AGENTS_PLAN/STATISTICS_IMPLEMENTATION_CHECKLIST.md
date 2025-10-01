# Statistics Implementation Checklist

## Overview
10 innovative statistical modules to transform the dashboard into a world-class lottery analysis platform.

---

## Phase 1: Foundation (Week 1) ⭐ START HERE

### Setup
- [ ] Install Recharts: `bun add recharts`
- [ ] Add chart color tokens to `app/globals.css`
- [ ] Update `lib/constants.ts` with chart config

### Chart Components (RSC-compatible)
- [ ] `components/charts/bar-chart.tsx` (client wrapper)
- [ ] `components/charts/line-chart.tsx`
- [ ] `components/charts/heatmap.tsx`
- [ ] `components/charts/index.ts` (barrel export)

### Module 1: Delay Analysis
- [ ] Create `lib/analytics/delay-analysis.ts`
- [ ] Implement `getNumberDelays()` method
- [ ] Add TypeScript interfaces
- [ ] Create heatmap visualization component
- [ ] Add section to `app/dashboard/statistics/page.tsx`
- [ ] Write tests: `tests/lib/analytics/delay-analysis.test.ts`

### Module 2: Decade Distribution
- [ ] Create `lib/analytics/decade-analysis.ts`
- [ ] Implement `getDecadeDistribution()` method
- [ ] Create horizontal bar chart component
- [ ] Add section to statistics page
- [ ] Write tests

### Module 8: Time-Series Frequency
- [ ] Create `lib/analytics/time-series.ts`
- [ ] Implement `getFrequencyTimeSeries()` method
- [ ] Create multi-line chart component
- [ ] Add interactive number selector (client component)
- [ ] Optional: Create dedicated page `app/dashboard/trends/page.tsx`
- [ ] Write tests

**Deliverable**: 3 working modules with charts, ~800 LOC

---

## Phase 2: Advanced Patterns (Week 2)

### Database Migration
- [ ] Create `db/migrations/003_pair_frequency_cache.sql`
- [ ] Add `number_pair_frequency` table
- [ ] Add indexes for performance
- [ ] Run migration: `bun run db:migrate`

### Module 3: Pair Co-occurrence
- [ ] Create `lib/analytics/pair-analysis.ts`
- [ ] Implement `getNumberPairs()` method
- [ ] Create cache update logic
- [ ] Build interactive heatmap or top-pairs table
- [ ] Add section to statistics page
- [ ] Write tests

### Module 5: Even/Odd Distribution
- [ ] Create `lib/analytics/parity-analysis.ts`
- [ ] Implement `getParityDistribution()` method
- [ ] Create donut/pie chart component
- [ ] Add section to statistics page
- [ ] Write tests

### Module 6: Prime Number Analysis
- [ ] Create `lib/analytics/prime-analysis.ts`
- [ ] Define `PRIME_NUMBERS` constant
- [ ] Implement `getPrimeDistribution()` method
- [ ] Create stat card component
- [ ] Add to dashboard or statistics page
- [ ] Write tests

**Deliverable**: 3 advanced modules, database optimization, ~600 LOC

---

## Phase 3: Engagement & Gamification (Week 3)

### Module 4: Sum Distribution
- [ ] Create `lib/analytics/sum-analysis.ts`
- [ ] Implement `getSumDistribution()` method
- [ ] Calculate mean, median, percentiles
- [ ] Create bell curve histogram
- [ ] Add section to statistics page
- [ ] Write tests

### Module 7: Hot Streak Detection
- [ ] Create `lib/analytics/streak-analysis.ts`
- [ ] Implement `getHotStreaks(windowSize)` method
- [ ] Create badge/tag component for trending numbers
- [ ] Add "Trending Numbers" section to dashboard
- [ ] Write tests

### Module 9: Prize Correlation
- [ ] Create `lib/analytics/prize-correlation.ts`
- [ ] Implement `getPrizeCorrelation()` method
- [ ] Create scatter plot or sorted table
- [ ] Add section to statistics page
- [ ] Write tests

### Module 10: Complexity Score
- [ ] Create `lib/analytics/complexity-score.ts`
- [ ] Implement `calculateComplexityScore()` method
- [ ] Define scoring algorithm (consecutive, primes, sum, etc.)
- [ ] Add score badges to recent draws display
- [ ] Update `app/dashboard/page.tsx`
- [ ] Write tests

**Deliverable**: 4 engagement modules, gamification elements, ~700 LOC

---

## Phase 4: Polish & Testing (Week 4)

### Visual Polish
- [ ] Consistent color scheme across all charts
- [ ] Responsive design testing (mobile, tablet, desktop)
- [ ] Dark/light mode verification for all modules
- [ ] Accessibility audit (ARIA labels, keyboard nav)

### Performance Optimization
- [ ] Implement caching layer (Map<string, CachedData>)
- [ ] Batch database queries in transactions
- [ ] Add loading skeletons for slow queries
- [ ] Monitor query times (add logging)
- [ ] Optimize pair analysis query

### Documentation
- [ ] Update `README.md` with new features
- [ ] Add inline comments for complex algorithms
- [ ] Create `docs/USER_GUIDE.md` for statistics interpretation
- [ ] Document API endpoints
- [ ] Add JSDoc to all public methods

### Testing & Quality
- [ ] Unit tests for all 10 modules (80%+ coverage)
- [ ] Integration test for statistics page
- [ ] Visual regression testing (screenshots)
- [ ] Load testing (1000+ draw dataset)
- [ ] Cross-browser testing

**Deliverable**: Production-ready, tested, documented, ~500 LOC

---

## API Updates

### Extend Existing Endpoints
- [ ] `app/api/statistics/route.ts` - Add query params:
  - `?delay=true`
  - `?decades=true`
  - `?pairs=true`
  - `?parity=true`
  - `?primes=true`
  - `?sum=true`

### New Endpoints
- [ ] `app/api/trends/route.ts`
  - `GET /api/trends?numbers=5,10,23&period=yearly`
- [ ] `app/api/streaks/route.ts`
  - `GET /api/streaks?window=10`
- [ ] `app/api/complexity/route.ts`
  - `POST /api/complexity` (body: { numbers: number[] })

---

## Component Updates

### `app/dashboard/page.tsx`
- [ ] Add "Trending Numbers" card (Module 7)
- [ ] Show complexity scores on recent draws (Module 10)
- [ ] Add navigation to new trends page

### `app/dashboard/statistics/page.tsx`
- [ ] Add Delay Analysis section (Module 1)
- [ ] Add Decade Distribution chart (Module 2)
- [ ] Add Pair Correlations table (Module 3)
- [ ] Add Sum Distribution chart (Module 4)
- [ ] Add Parity Distribution donut (Module 5)
- [ ] Add Prime Analysis card (Module 6)
- [ ] Add Prize Correlation scatter plot (Module 9)

### New Page: `app/dashboard/trends/page.tsx`
- [ ] Interactive time-series chart (Module 8)
- [ ] Number selector (multi-select, max 6)
- [ ] Period selector (yearly/quarterly/monthly)
- [ ] Export functionality (CSV)

---

## Constants Updates (`lib/constants.ts`)

```typescript
// Add to file:
export const CHART_CONFIG = {
  HEATMAP_COLORS: ['#dbeafe', '#93c5fd', '#60a5fa', '#fb923c', '#ef4444'],
  MAX_TIME_SERIES_NUMBERS: 6,
  DEFAULT_STREAK_WINDOW: 10,
} as const;

export const PRIME_NUMBERS = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59
] as const;

export const DECADES = [
  { label: '01-10', range: [1, 10] },
  { label: '11-20', range: [11, 20] },
  { label: '21-30', range: [21, 30] },
  { label: '31-40', range: [31, 40] },
  { label: '41-50', range: [41, 50] },
  { label: '51-60', range: [51, 60] },
] as const;
```

---

## Success Criteria

### Performance
- [ ] Statistics page loads in < 2 seconds
- [ ] Each analytics module query < 100ms
- [ ] Chart rendering smooth (60fps)
- [ ] Bundle size increase < 150KB

### Quality
- [ ] Test coverage > 80%
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings
- [ ] Passes accessibility audit

### User Experience
- [ ] All charts responsive
- [ ] Dark/light mode works
- [ ] Interactive elements clear
- [ ] No layout shift (CLS < 0.1)

---

## Quick Start Commands

```bash
# Install dependencies
bun install

# Run migrations
bun run db:migrate

# Start dev server
bun run dev

# Run tests
bun run test

# Check coverage
bunx vitest --coverage

# Lint
bun run lint --fix
```

---

## Priority Matrix

| Module | Priority | Complexity | User Value | Week |
|--------|----------|------------|------------|------|
| Delay Analysis | ⭐⭐⭐ | Low | High | 1 |
| Decade Distribution | ⭐⭐⭐ | Low | High | 1 |
| Time-Series | ⭐⭐ | Medium | High | 1 |
| Pair Co-occurrence | ⭐⭐⭐ | High | Very High | 2 |
| Even/Odd | ⭐⭐ | Low | Medium | 2 |
| Prime Analysis | ⭐ | Low | Low | 2 |
| Sum Distribution | ⭐⭐ | Medium | Medium | 3 |
| Hot Streaks | ⭐⭐ | Medium | High | 3 |
| Prize Correlation | ⭐⭐ | Medium | Medium | 3 |
| Complexity Score | ⭐ | Low | Medium | 3 |

---

## Notes

- All analytics code uses **Server Components** (no `'use client'`)
- Charts require client wrappers (`'use client'`) but data fetching stays server-side
- Follow existing patterns in `lib/analytics/statistics.ts`
- Use TypeScript strict mode, explicit return types
- Maintain kebab-case file names
- Reference `CHART_COLORS` from constants, not hardcoded values

---

## Questions Before Starting?

1. Should we prioritize mobile or desktop first?
   → **Mobile-first, but ensure desktop looks premium**

2. Which chart library?
   → **Recharts (React-friendly, tree-shakeable)**

3. Should we create separate pages or keep in one?
   → **Start with one page, split if needed (trends page optional)**

4. Real-time updates or static?
   → **Static (force-dynamic), updates on page reload**

---

**Ready to implement?** Start with Phase 1, Module 1 (Delay Analysis).

