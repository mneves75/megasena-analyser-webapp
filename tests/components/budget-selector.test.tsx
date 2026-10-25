import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BudgetSelector } from '@/components/bet-generator/budget-selector';

describe('BudgetSelector', () => {
  it.each([
    ['50,00', 50],
    ['R$ 50,50', 50.5],
    ['1.200,50', 1200.5],
    ['1200', 1200],
    ['', 0],
    ['50,00x', 0],
  ])('interprets %s without inflating the budget', (input, expected) => {
    const onChange = vi.fn();
    render(<BudgetSelector value={50} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Valor Personalizado/i), { target: { value: input } });
    expect(onChange).toHaveBeenLastCalledWith(expected);
  });

  it('names the preset buttons as a group instead of an orphan label', () => {
    const { container } = render(<BudgetSelector value={50} onChange={vi.fn()} />);
    const group = screen.getByRole('group', { name: 'Valores Rápidos' });
    expect(group.querySelectorAll('button').length).toBe(9);
    expect([...container.querySelectorAll('label')].every(label => label.htmlFor || label.control)).toBe(true);
  });
});
