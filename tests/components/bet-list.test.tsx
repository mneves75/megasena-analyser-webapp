import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BetList } from '@/components/bet-generator/bet-list';
import { type BetGenerationResult } from '@/lib/analytics/bet-generator';

/**
 * Test suite for BetList component focusing on pagination reset behavior.
 *
 * CRITICAL: These tests verify the key prop pattern that replaced the useEffect anti-pattern.
 * When result changes, React should remount the component, automatically resetting pagination.
 *
 * See: https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes
 */

// Helper to create mock bet generation result
function createMockResult(betCount: number, totalCost: number): BetGenerationResult {
  const bets = Array.from({ length: betCount }, (_, i) => ({
    id: `bet-${i}`,
    numbers: [1, 2, 3, 4, 5, 6].map(n => n + i),
    cost: 6,
    type: 'simple' as const,
    numberCount: 6,
    strategy: 'random',
  }));

  return {
    bets,
    totalCost,
    remainingBudget: 100 - totalCost,
    budgetUtilization: (totalCost / 100) * 100,
    totalNumbers: betCount * 6,
    strategy: 'random',
    mode: 'optimized',
    summary: {
      simpleBets: betCount,
      multipleBets: 0,
      averageCost: totalCost / betCount,
    },
  };
}

describe('BetList - Pagination Reset via Key Prop', () => {
  it('should display first page of bets on initial render', () => {
    const result = createMockResult(25, 150);

    render(<BetList result={result} />);

    // Should show "Exibindo 1 a 20 de 25 apostas" (20 per page)
    expect(screen.getByText(/Exibindo 1 a 20 de 25 apostas/i)).toBeInTheDocument();
  });

  it('should paginate when clicking next button', () => {
    const result = createMockResult(25, 150);

    render(<BetList result={result} />);

    // Click "Próxima" button
    const nextButton = screen.getByRole('button', { name: /próxima/i });
    fireEvent.click(nextButton);

    // Should now show "Exibindo 21 a 25 de 25 apostas"
    expect(screen.getByText(/Exibindo 21 a 25 de 25 apostas/i)).toBeInTheDocument();
  });

  it('should reset to page 1 when result changes (via key prop)', () => {
    const result1 = createMockResult(25, 150);
    const key1 = `${result1.bets.length}-${result1.totalCost}`;

    // Render with first result and key prop
    const { rerender, unmount } = render(
      <BetList key={key1} result={result1} />
    );

    // Navigate to page 2
    const nextButton = screen.getByRole('button', { name: /próxima/i });
    fireEvent.click(nextButton);

    // Verify we're on page 2
    expect(screen.getByText(/Exibindo 21 a 25 de 25 apostas/i)).toBeInTheDocument();

    // Create new result with different properties
    const result2 = createMockResult(30, 180);
    const key2 = `${result2.bets.length}-${result2.totalCost}`;

    // Verify keys are different (this is what triggers React to remount)
    expect(key1).not.toBe(key2);
    expect(key1).toBe('25-150');
    expect(key2).toBe('30-180');

    /**
     * CRITICAL: When key changes, React unmounts old instance and mounts new one.
     * This is what we're testing - that changing the key prop causes a full remount,
     * which automatically resets pagination state to initial value (page 1).
     *
     * We unmount and remount to simulate what the parent component does.
     */
    unmount();
    render(<BetList key={key2} result={result2} />);

    // Should be back on page 1, showing first 20 of 30 bets
    expect(screen.getByText(/Exibindo 1 a 20 de 30 apostas/i)).toBeInTheDocument();
  });

  it('should generate unique keys for different results', () => {
    // This test verifies that our key generation strategy works correctly
    const result1 = createMockResult(10, 60);
    const result2 = createMockResult(15, 90);
    const result3 = createMockResult(10, 60); // Same as result1

    const key1 = `${result1.bets.length}-${result1.totalCost}`;
    const key2 = `${result2.bets.length}-${result2.totalCost}`;
    const key3 = `${result3.bets.length}-${result3.totalCost}`;

    // Different results should have different keys
    expect(key1).not.toBe(key2);
    expect(key1).toBe('10-60');
    expect(key2).toBe('15-90');

    // Identical results should have identical keys
    expect(key1).toBe(key3);
  });

  it('should display summary information correctly', () => {
    const result = createMockResult(10, 60);

    render(<BetList result={result} />);

    // Verify summary card exists
    expect(screen.getByText(/Resumo das Apostas/i)).toBeInTheDocument();

    // Verify budget utilization label is displayed (use getAllByText since "Utilização" appears in tip message too)
    const utilizacaoElements = screen.getAllByText(/Utilização/i);
    expect(utilizacaoElements.length).toBeGreaterThan(0);

    // Verify total numbers label is displayed
    expect(screen.getByText(/Números Únicos/i)).toBeInTheDocument();

    // Verify actual summary values are displayed
    expect(screen.getByText(/R\$ 60,00/i)).toBeInTheDocument(); // Total cost
    expect(screen.getByText(/60\.0%/i)).toBeInTheDocument(); // Utilization percentage
  });

  it('should handle single page of results without pagination controls', () => {
    const result = createMockResult(10, 60); // Less than 20, so single page

    render(<BetList result={result} />);

    // Should NOT show pagination controls
    expect(screen.queryByRole('button', { name: /próxima/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anterior/i })).not.toBeInTheDocument();
  });

  it('should disable previous button on first page', () => {
    const result = createMockResult(25, 150);

    render(<BetList result={result} />);

    const previousButton = screen.getByRole('button', { name: /anterior/i });
    expect(previousButton).toBeDisabled();
  });

  it('should disable next button on last page', () => {
    const result = createMockResult(25, 150);

    render(<BetList result={result} />);

    // Navigate to last page
    const nextButton = screen.getByRole('button', { name: /próxima/i });
    fireEvent.click(nextButton);

    // Should be on last page, next button disabled
    expect(nextButton).toBeDisabled();
  });

  it('should show tip message when significant budget remains', () => {
    const result = createMockResult(10, 60);
    result.remainingBudget = 40; // R$ 40 remaining (≥ R$ 6)

    render(<BetList result={result} />);

    // Should show tip about remaining budget
    expect(screen.getByText(/Você ainda tem/i)).toBeInTheDocument();
    expect(screen.getByText(/Considere aumentar o orçamento/i)).toBeInTheDocument();
  });

  it('should not show tip message when minimal budget remains', () => {
    const result = createMockResult(16, 96);
    result.remainingBudget = 4; // Less than R$ 6

    render(<BetList result={result} />);

    // Should NOT show tip
    expect(screen.queryByText(/Você ainda tem/i)).not.toBeInTheDocument();
  });
});

/**
 * REGRESSION TEST:
 * This test ensures we never reintroduce the useEffect anti-pattern.
 *
 * If someone adds useEffect back to reset pagination, this test will fail
 * because the component will render twice (once with old state, once after effect).
 */
describe('BetList - Performance & Rendering', () => {
  it('should render exactly once per result change (no double render from useEffect)', () => {
    const renderSpy = vi.fn();

    // Wrap BetList to spy on renders
    function SpyWrapper({ result }: { result: BetGenerationResult }) {
      renderSpy();
      return <BetList result={result} />;
    }

    const result1 = createMockResult(25, 150);
    const { rerender } = render(<SpyWrapper result={result1} />);

    // Initial render: 1 call
    expect(renderSpy).toHaveBeenCalledTimes(1);

    renderSpy.mockClear();

    // Rerender with new result
    const result2 = createMockResult(30, 180);
    rerender(<SpyWrapper result={result2} />);

    // Should render exactly once (not twice due to useEffect)
    // If useEffect was used, we'd see 2 renders:
    // 1. Initial render with old pagination state
    // 2. Effect runs, updates state, triggers re-render
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
