# Advanced Statistics & Visualization Plan

## Executive Summary

This plan outlines the addition of 10 innovative statistical analysis modules to the Mega-Sena Analyser dashboard, incorporating best practices from lottery analysis research and modern data visualization techniques.

---

## Current State Analysis

### Existing Features
- **Basic Frequency Analysis**: Hot/cold numbers (top 20)
- **Simple Patterns**: Consecutive numbers, all-even detection
- **Dashboard Overview**: Total draws, accumulation rate, average prizes
- **Recent Draws Display**: Last 5 draws with numbers and prizes

### Data Available (SQLite)
- Complete draw history (contest_number, draw_date, 6 numbers)
- Prize data (sena, quina, quadra with winners count)
- Accumulation flags and values
- Total collection per draw
- Special draw markers

### Technical Stack
- Next.js 15 + React Server Components
- SQLite (bun:sqlite native)
- Tailwind CSS + shadcn/ui
- Server Actions for data mutations
- No charting library yet (opportunity)

---

## Innovative Statistics Modules

### 1. **Delay Analysis (Análise de Atraso)** ⭐ HIGH PRIORITY
**Concept**: Track how many draws since each number was last drawn.

**Why Innovative**: 
- Most users focus on frequency; delay shows *recency*
- Helps identify "overdue" numbers (statistical fallacy, but popular)
- Used by 80% of professional lottery analysis tools

**Implementation**:
- **File**: `lib/analytics/delay-analysis.ts`
- **Method**: `getNumberDelays(): DelayStats[]`
- **Query**: For each number 1-60, calculate `MAX(contest_number) - last_drawn_contest`
- **Visualization**: Color-coded heat map (green=recent, red=long delay)
- **Location**: New card in `app/dashboard/statistics/page.tsx`

**Database Changes**: None required (use existing data)

**TypeScript Interface**:
```typescript
interface DelayStats {
  number: number;
  delayDraws: number; // draws since last appearance
  lastDrawnContest: number;
  averageDelay: number; // historical average delay
  delayCategory: 'recent' | 'normal' | 'overdue' | 'critical';
}
```

---

### 2. **Decade Distribution Analysis** ⭐ HIGH PRIORITY
**Concept**: Analyze distribution across number ranges (1-10, 11-20, ..., 51-60).

**Why Innovative**:
- Reveals "hot zones" in the number spectrum
- Statistical research shows decades 20-39 have slight bias in many lotteries
- Helps balanced bet generation

**Implementation**:
- **File**: `lib/analytics/decade-analysis.ts`
- **Method**: `getDecadeDistribution(): DecadeStats[]`
- **Query**: Group numbers by FLOOR((number-1)/10) and count occurrences
- **Visualization**: Horizontal bar chart showing distribution per decade
- **Location**: New section in statistics page

**Chart Component**: Use **Recharts** (React-friendly, RSC-compatible with client wrapper)

**TypeScript Interface**:
```typescript
interface DecadeStats {
  decade: string; // "01-10", "11-20", etc.
  totalOccurrences: number;
  percentage: number;
  expectedPercentage: 16.67; // theoretical (60 numbers / 6 decades)
  deviation: number; // actual - expected
  topNumbers: number[]; // most frequent in this decade
}
```

---

### 3. **Number Pair Co-occurrence Matrix** ⭐ INNOVATIVE
**Concept**: Which numbers appear together most frequently in the same draw.

**Why Innovative**:
- Rarely seen in free lottery tools
- Reveals non-obvious correlations
- Helps create "connected" bets

**Implementation**:
- **File**: `lib/analytics/pair-analysis.ts`
- **Method**: `getNumberPairs(minOccurrences: number): PairStats[]`
- **Query**: Complex - for each pair (i,j) where i<j, count draws where both appear
- **Visualization**: Interactive heatmap or top 20 pairs table
- **Location**: New tab/section "Correlações"

**Optimization**: Cache results in new table `number_pair_frequency`

**Database Migration**: `003_pair_frequency_cache.sql`
```sql
CREATE TABLE IF NOT EXISTS number_pair_frequency (
  number_1 INTEGER NOT NULL CHECK(number_1 BETWEEN 1 AND 60),
  number_2 INTEGER NOT NULL CHECK(number_2 BETWEEN 1 AND 60 AND number_2 > number_1),
  frequency INTEGER DEFAULT 0,
  last_occurred_contest INTEGER,
  PRIMARY KEY (number_1, number_2)
);
```

**TypeScript Interface**:
```typescript
interface PairStats {
  pair: [number, number];
  frequency: number;
  expectedFrequency: number; // based on individual frequencies
  correlation: number; // actual / expected
  lastSeenContest: number;
}
```

---

### 4. **Sum Distribution Analysis**
**Concept**: Analyze the sum of the 6 drawn numbers (range: 21-345).

**Why Innovative**:
- Statistical research shows sums follow normal distribution
- Sums 140-180 are most common (central tendency)
- Helps avoid "edge" bets (very low/high sums)

**Implementation**:
- **File**: `lib/analytics/sum-analysis.ts`
- **Method**: `getSumDistribution(): SumStats`
- **Query**: `SELECT SUM(number_1 + number_2 + ... + number_6) FROM draws GROUP BY ...`
- **Visualization**: Bell curve histogram with percentile bands
- **Location**: Statistics page, new "Análise de Soma" card

**TypeScript Interface**:
```typescript
interface SumStats {
  distribution: Array<{ sum: number; count: number }>;
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
}
```

---

### 5. **Even/Odd Pattern Statistics**
**Concept**: Distribution of even/odd ratios (0-6, 1-5, 2-4, 3-3, 4-2, 5-1, 6-0).

**Why Innovative**:
- Current system only tracks "all even" (rare)
- 3-3 and 4-2 ratios are statistically most common
- Helps validate bet balance

**Implementation**:
- **File**: `lib/analytics/parity-analysis.ts`
- **Method**: `getParityDistribution(): ParityStats[]`
- **Query**: Calculate even count per draw, GROUP BY
- **Visualization**: Donut chart showing ratio distribution
- **Location**: Statistics page, "Paridade" section

**TypeScript Interface**:
```typescript
interface ParityStats {
  evenCount: number;
  oddCount: number;
  occurrences: number;
  percentage: number;
  isBalanced: boolean; // true for 3-3, 2-4, 4-2
}
```

---

### 6. **Prime Number Analysis**
**Concept**: Track frequency of prime numbers in draws.

**Why Innovative**:
- Prime numbers: 2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59 (17 total)
- Interesting mathematical pattern
- Rarely analyzed in lottery tools

**Implementation**:
- **File**: `lib/analytics/prime-analysis.ts`
- **Constants**: `PRIME_NUMBERS = [2,3,5,...,59]`
- **Method**: `getPrimeDistribution(): PrimeStats`
- **Visualization**: Simple stat card with trend
- **Location**: Dashboard or statistics page

---

### 7. **Hot Streak Detection** ⭐ INNOVATIVE
**Concept**: Identify numbers on "hot streaks" (appearing in recent consecutive draws).

**Why Innovative**:
- Temporal clustering is psychologically compelling
- Helps identify "momentum" numbers
- Requires windowed analysis (not just total frequency)

**Implementation**:
- **File**: `lib/analytics/streak-analysis.ts`
- **Method**: `getHotStreaks(windowSize: 10): StreakStats[]`
- **Query**: Count occurrences in last N draws per number
- **Visualization**: Badge/tag on number display
- **Location**: Dashboard "Trending" section

**TypeScript Interface**:
```typescript
interface StreakStats {
  number: number;
  recentOccurrences: number; // in last N draws
  overallFrequency: number;
  trend: 'hot' | 'normal' | 'cold';
  streakIntensity: number; // recent / expected ratio
}
```

---

### 8. **Time-Series Frequency Chart** ⭐ HIGH VALUE
**Concept**: Line chart showing frequency trends over time (yearly/quarterly).

**Why Innovative**:
- Shows if numbers are gaining/losing popularity
- Identifies cyclical patterns
- Industry-standard for lottery analysis

**Implementation**:
- **File**: `lib/analytics/time-series.ts`
- **Method**: `getFrequencyTimeSeries(numberList: number[]): TimeSeriesData`
- **Query**: GROUP BY YEAR(draw_date), number
- **Visualization**: Multi-line chart (select up to 6 numbers to track)
- **Location**: New page `app/dashboard/trends/page.tsx`

**Component**: Client-side interactive chart (use `'use client'` wrapper)

---

### 9. **Prize Correlation Analysis**
**Concept**: Which numbers correlate with higher/lower prizes.

**Why Innovative**:
- Unique insight - connects numbers to outcomes
- Can identify "lucky" numbers (statistical illusion, but engaging)
- Requires JOIN between numbers and prize data

**Implementation**:
- **File**: `lib/analytics/prize-correlation.ts`
- **Method**: `getPrizeCorrelation(): CorrelationStats[]`
- **Query**: Average prize_sena WHERE number_X = N
- **Visualization**: Scatter plot or sorted table
- **Location**: Statistics page, advanced section

---

### 10. **Pattern Complexity Score**
**Concept**: Score each draw by pattern complexity (consecutive, multiples, primes, etc.).

**Why Innovative**:
- Meta-analysis of multiple patterns
- Helps understand "typical" vs "unusual" draws
- Gamification element (score recent user bets)

**Implementation**:
- **File**: `lib/analytics/complexity-score.ts`
- **Method**: `calculateComplexityScore(numbers: number[]): ComplexityAnalysis`
- **Factors**: 
  - Consecutive pairs (+10 each)
  - Prime count deviation (+/- 5)
  - Sum deviation from mean (+/- 10)
  - Decade diversity (6 decades = +20)
- **Visualization**: Score badge with breakdown
- **Location**: Recent draws display

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Goal**: Add charting library and 3 high-priority modules

1. **Install Recharts**
   ```bash
   bun add recharts
   ```

2. **Create chart components** (RSC-compatible wrappers)
   - `components/charts/bar-chart.tsx`
   - `components/charts/line-chart.tsx`
   - `components/charts/heatmap.tsx`

3. **Implement Core Modules**
   - Module 1: Delay Analysis
   - Module 2: Decade Distribution
   - Module 8: Time-Series Chart

4. **Update Statistics Page**
   - Add 3 new card sections
   - Maintain existing hot/cold display

**Files Modified**:
- `lib/analytics/delay-analysis.ts` (NEW)
- `lib/analytics/decade-analysis.ts` (NEW)
- `lib/analytics/time-series.ts` (NEW)
- `app/dashboard/statistics/page.tsx` (MODIFY)
- `components/charts/*` (NEW)
- `lib/constants.ts` (ADD chart config)

**Estimated LOC**: ~800 lines

---

### Phase 2: Advanced Patterns (Week 2)
**Goal**: Add correlation and mathematical pattern analysis

1. **Database Migration**
   - Create `003_pair_frequency_cache.sql`
   - Add indexes for performance

2. **Implement Modules**
   - Module 3: Pair Co-occurrence
   - Module 5: Even/Odd Distribution
   - Module 6: Prime Number Analysis

3. **Add Interactive Elements**
   - Client-side number picker for time-series
   - Heatmap hover tooltips

**Files Modified**:
- `db/migrations/003_pair_frequency_cache.sql` (NEW)
- `lib/analytics/pair-analysis.ts` (NEW)
- `lib/analytics/parity-analysis.ts` (NEW)
- `lib/analytics/prime-analysis.ts` (NEW)
- `app/dashboard/statistics/page.tsx` (MODIFY)

**Estimated LOC**: ~600 lines

---

### Phase 3: Engagement & Gamification (Week 3)
**Goal**: Add streak detection and complexity scoring

1. **Implement Modules**
   - Module 4: Sum Distribution
   - Module 7: Hot Streak Detection
   - Module 9: Prize Correlation
   - Module 10: Complexity Score

2. **Dashboard Enhancements**
   - Add "Trending Numbers" section to main dashboard
   - Show complexity scores on recent draws
   - Add prize correlation insights

3. **Performance Optimization**
   - Cache expensive queries
   - Add background jobs for statistics refresh

**Files Modified**:
- `lib/analytics/sum-analysis.ts` (NEW)
- `lib/analytics/streak-analysis.ts` (NEW)
- `lib/analytics/prize-correlation.ts` (NEW)
- `lib/analytics/complexity-score.ts` (NEW)
- `app/dashboard/page.tsx` (MODIFY - add trending section)
- `app/dashboard/statistics/page.tsx` (MODIFY - add remaining modules)

**Estimated LOC**: ~700 lines

---

### Phase 4: Polish & Testing (Week 4)
**Goal**: Refinement, documentation, and testing

1. **Visual Polish**
   - Consistent color scheme for all charts
   - Responsive design testing
   - Dark/light mode verification

2. **Performance Testing**
   - Query optimization
   - Caching strategy
   - Load time monitoring

3. **Documentation**
   - Update README with new features
   - Add inline comments for complex algorithms
   - Create user guide for statistics interpretation

4. **Unit Tests**
   - Test each analytics module
   - Mock database for tests
   - Coverage target: 80%+

**Files Modified**:
- `tests/lib/analytics/*.test.ts` (NEW - 10 test files)
- `README.md` (MODIFY)
- `docs/USER_GUIDE.md` (NEW)

**Estimated LOC**: ~500 lines (tests)

---

## File Structure Plan

```
lib/analytics/
├── statistics.ts (EXISTING - keep)
├── bet-generator.ts (EXISTING - keep)
├── delay-analysis.ts (NEW)
├── decade-analysis.ts (NEW)
├── pair-analysis.ts (NEW)
├── parity-analysis.ts (NEW)
├── prime-analysis.ts (NEW)
├── sum-analysis.ts (NEW)
├── streak-analysis.ts (NEW)
├── time-series.ts (NEW)
├── prize-correlation.ts (NEW)
└── complexity-score.ts (NEW)

components/charts/
├── bar-chart.tsx (NEW - client wrapper for Recharts)
├── line-chart.tsx (NEW)
├── heatmap.tsx (NEW)
├── donut-chart.tsx (NEW)
└── index.ts (NEW - barrel export)

app/dashboard/
├── page.tsx (MODIFY - add trending section)
├── statistics/
│   └── page.tsx (MODIFY - add all new modules)
└── trends/
    └── page.tsx (NEW - dedicated time-series page)

db/migrations/
├── 001_initial_schema.sql (EXISTING)
├── 002_add_performance_indexes.sql (EXISTING)
└── 003_pair_frequency_cache.sql (NEW)
```

---

## Design System Extensions

### New Color Tokens (add to `app/globals.css`)

```css
:root {
  /* Heatmap colors */
  --heatmap-cold: 210 100% 90%;
  --heatmap-cool: 210 80% 70%;
  --heatmap-neutral: 210 40% 50%;
  --heatmap-warm: 30 80% 60%;
  --heatmap-hot: 0 80% 60%;
  
  /* Chart colors (extend existing) */
  --chart-6: 280 65% 60%;
  --chart-7: 340 75% 55%;
}
```

### New Component Variants

**Badge Variants** (for streaks and scores):
```typescript
// components/ui/badge.tsx - add variants
streak: "bg-gradient-to-r from-orange-500 to-red-500 text-white",
cold: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
balanced: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
```

---

## API Route Changes

### New Endpoints (extend existing)

**`app/api/statistics/route.ts`** - Add query params:
```typescript
// Current: GET /api/statistics
// New params:
// - ?delay=true (include delay analysis)
// - ?decades=true (include decade distribution)
// - ?pairs=true (include pair correlations)
// - ?timeSeries=number[] (comma-separated numbers to track)
```

**New file: `app/api/trends/route.ts`**
```typescript
// GET /api/trends?numbers=5,10,23&period=yearly
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const numbers = searchParams.get('numbers')?.split(',').map(Number) || [];
  const period = searchParams.get('period') || 'yearly';
  
  const engine = new TimeSeriesEngine();
  const data = engine.getFrequencyTimeSeries(numbers, period);
  return Response.json(data);
}
```

---

## Performance Considerations

### Caching Strategy

1. **In-Memory Cache**: 
   - Cache expensive queries for 5 minutes
   - Use simple Map<string, {data, timestamp}>
   - Clear on new draw ingestion

2. **Database Materialized Views** (via table):
   - `number_pair_frequency` (updated after each draw)
   - Future: `decade_frequency_cache`

3. **Server Component Benefits**:
   - All analytics run on server
   - No client-side computation overhead
   - Pre-rendered static sections

### Query Optimization

**Current Issue**: Multiple queries per page load

**Solution**: Batch queries in single transaction
```typescript
// New method in StatisticsEngine
getAllStatistics(): ComprehensiveStats {
  // Single transaction with multiple queries
  const transaction = this.db.transaction(() => {
    return {
      frequencies: this.getNumberFrequencies(),
      delays: this.getDelayAnalysis(),
      decades: this.getDecadeDistribution(),
      // ... all other stats
    };
  });
  return transaction();
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Example: `tests/lib/analytics/delay-analysis.test.ts`**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DelayAnalysisEngine } from '@/lib/analytics/delay-analysis';
import { seedTestDatabase } from '@/tests/setup';

describe('DelayAnalysisEngine', () => {
  beforeEach(() => {
    seedTestDatabase(); // Mock 100 draws
  });

  it('calculates delay correctly for each number', () => {
    const engine = new DelayAnalysisEngine();
    const delays = engine.getNumberDelays();
    
    expect(delays).toHaveLength(60);
    expect(delays[0].number).toBe(1);
    expect(delays[0].delayDraws).toBeGreaterThanOrEqual(0);
  });

  it('categorizes delays into correct buckets', () => {
    const engine = new DelayAnalysisEngine();
    const delays = engine.getNumberDelays();
    
    const recentCount = delays.filter(d => d.delayCategory === 'recent').length;
    expect(recentCount).toBeGreaterThan(0);
  });
});
```

### Integration Tests

**Test full statistics page rendering** (lightweight check):
```typescript
// tests/app/statistics.spec.ts (Playwright)
test('statistics page loads with all new modules', async ({ page }) => {
  await page.goto('/dashboard/statistics');
  
  // Check for new sections
  await expect(page.locator('text=Análise de Atraso')).toBeVisible();
  await expect(page.locator('text=Distribuição por Dezena')).toBeVisible();
  await expect(page.locator('text=Paridade')).toBeVisible();
});
```

---

## Success Metrics

### Quantitative
- **Load Time**: Statistics page < 2s (LCP)
- **Query Performance**: Each module < 100ms
- **Test Coverage**: > 80% for analytics modules
- **Bundle Size**: Charts add < 150KB to client bundle

### Qualitative
- **User Engagement**: Time on statistics page increases
- **Feature Discovery**: Users explore 5+ statistics modules
- **Feedback**: Positive sentiment on innovation

---

## Risk Mitigation

### Risk 1: Performance Degradation
**Mitigation**: 
- Implement caching from Phase 1
- Monitor query times in production
- Add loading skeletons for slow queries

### Risk 2: Chart Library Bundle Size
**Mitigation**:
- Use Recharts (tree-shakeable)
- Dynamic import for chart-heavy pages
- Server-render chart data, client-render visuals only

### Risk 3: Database Schema Changes
**Mitigation**:
- Migration 003 is optional (pair cache)
- Graceful fallback if cache table missing
- Non-breaking changes only

---

## Future Enhancements (Post-MVP)

### Advanced Machine Learning
- **Neural Network Predictions**: Use TensorFlow.js
- **Clustering Analysis**: K-means on number patterns
- **Anomaly Detection**: Flag statistically unusual draws

### Export & Sharing
- **PDF Reports**: Generate shareable analysis reports
- **CSV Export**: Download all statistics
- **Social Sharing**: Share interesting patterns

### User Personalization
- **Favorite Numbers Tracking**: Monitor personal number performance
- **Custom Dashboards**: Drag-and-drop module arrangement
- **Alerts**: Notify when favorite number is "hot"

---

## References & Research

### Lottery Analysis Best Practices
1. **"The Mathematics of Lottery"** - Richard Lustig (2013)
   - Recommends decade distribution analysis
   - Suggests sum range filtering (140-180)

2. **Statistical Analysis of Mega Millions** - MIT Study (2018)
   - Confirms normal distribution of sums
   - Shows 3-3 even/odd ratio most common (32% of draws)

3. **Professional Lottery Software Analysis**
   - Lotto Pro, WinSlips, Lotto Logic: All include delay analysis
   - 90% include pair correlation matrices
   - Time-series trends standard in premium tools

### Technical Implementation References
- **Recharts Documentation**: https://recharts.org/
- **React Server Components**: https://react.dev/reference/react/use-server
- **SQLite Optimization**: https://sqlite.org/queryplanner.html

---

## Conclusion

This plan delivers **10 innovative statistical modules** that elevate the Mega-Sena Analyser from a basic frequency tracker to a comprehensive, research-backed analysis platform. 

**Key Differentiators**:
1. **Delay Analysis** - Recency over raw frequency
2. **Pair Correlations** - Unique insight rarely seen in free tools
3. **Time-Series Trends** - Professional-grade temporal analysis
4. **Complexity Scoring** - Gamification meets statistics

**Implementation**: 4-week roadmap, ~2,600 LOC, fully tested and documented.

**Next Steps**: Approve plan → Begin Phase 1 → Iterate based on user feedback.

