import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GenerationControls } from '@/components/bet-generator/generation-controls';
import { pt } from '@/lib/i18n';

function renderControls(overrides: Partial<Parameters<typeof GenerationControls>[0]> = {}) {
  const onStrategyChange = vi.fn();
  const onModeChange = vi.fn();
  const onGenerate = vi.fn();
  const utils = render(
    <GenerationControls
      strategy="balanced"
      mode="optimized"
      onStrategyChange={onStrategyChange}
      onModeChange={onModeChange}
      onGenerate={onGenerate}
      {...overrides}
    />
  );
  return { ...utils, onStrategyChange, onModeChange, onGenerate };
}

describe('GenerationControls radiogroups', () => {
  it('exposes both groups with their labels and one checked radio each', () => {
    renderControls();
    const strategyGroup = screen.getByRole('radiogroup', { name: pt.betGenerator.controls.strategyLabel });
    const modeGroup = screen.getByRole('radiogroup', { name: pt.betGenerator.controls.modeLabel });

    expect(within(strategyGroup).getAllByRole('radio')).toHaveLength(pt.betGenerator.strategies.length);
    expect(within(modeGroup).getAllByRole('radio')).toHaveLength(pt.betGenerator.modes.length);
    expect(within(strategyGroup).getAllByRole('radio', { checked: true })).toHaveLength(1);
    expect(within(modeGroup).getAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  it('keeps only the checked radio in the tab order (roving tabindex)', () => {
    renderControls();
    const modeGroup = screen.getByRole('radiogroup', { name: pt.betGenerator.controls.modeLabel });
    for (const radio of within(modeGroup).getAllByRole('radio')) {
      const checked = radio.getAttribute('aria-checked') === 'true';
      expect(radio).toHaveAttribute('tabindex', checked ? '0' : '-1');
    }
  });

  it('moves selection and focus with the arrow keys, wrapping at the ends', () => {
    const { onModeChange } = renderControls();
    const modeGroup = screen.getByRole('radiogroup', { name: pt.betGenerator.controls.modeLabel });
    const radios = within(modeGroup).getAllByRole('radio');
    const modes = pt.betGenerator.modes.map((m) => m.value);
    const checkedIndex = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');

    radios[checkedIndex]!.focus();
    fireEvent.keyDown(radios[checkedIndex]!, { key: 'ArrowDown' });
    const nextIndex = (checkedIndex + 1) % modes.length;
    expect(onModeChange).toHaveBeenLastCalledWith(modes[nextIndex]);
    expect(document.activeElement).toBe(radios[nextIndex]);

    fireEvent.keyDown(radios[0]!, { key: 'ArrowUp' });
    expect(onModeChange).toHaveBeenLastCalledWith(modes[modes.length - 1]);
    expect(document.activeElement).toBe(radios[modes.length - 1]);

    fireEvent.keyDown(radios[modes.length - 1]!, { key: 'Home' });
    expect(onModeChange).toHaveBeenLastCalledWith(modes[0]);
    fireEvent.keyDown(radios[0]!, { key: 'End' });
    expect(onModeChange).toHaveBeenLastCalledWith(modes[modes.length - 1]);
  });

  it('ignores unrelated keys', () => {
    const { onStrategyChange } = renderControls();
    const group = screen.getByRole('radiogroup', { name: pt.betGenerator.controls.strategyLabel });
    fireEvent.keyDown(within(group).getAllByRole('radio')[0]!, { key: 'Tab' });
    expect(onStrategyChange).not.toHaveBeenCalled();
  });

  it('disables only the generate button when disabled, so the mode can still change', () => {
    const { onModeChange } = renderControls({ disabled: true });
    expect(screen.getByRole('button', { name: pt.betGenerator.controls.generate })).toBeDisabled();
    const modeGroup = screen.getByRole('radiogroup', { name: pt.betGenerator.controls.modeLabel });
    const other = within(modeGroup)
      .getAllByRole('radio')
      .find((r) => r.getAttribute('aria-checked') !== 'true')!;
    fireEvent.click(other);
    expect(onModeChange).toHaveBeenCalledTimes(1);
  });

  it('marks the button busy while generating', () => {
    renderControls({ isGenerating: true });
    const button = screen.getByRole('button', { busy: true });
    expect(button).toHaveTextContent(pt.betGenerator.controls.generating);
    expect(button).toBeDisabled();
  });
});
