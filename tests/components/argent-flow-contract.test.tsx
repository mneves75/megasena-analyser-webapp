import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GeneratorForm } from '@/app/dashboard/generator/generator-form';

vi.mock('@/app/dashboard/generator/actions', () => ({ generateBets: vi.fn() }));
import { generateBets } from '@/app/dashboard/generator/actions';

/**
 * The saved Argent flows (.argent/flows/qa-generator-*.yaml) are the repo's UI
 * gate for the generator. Argent's Chromium walker reports the element's tag as
 * its role, so each `selector: { text, role }` pair must still match an element
 * of that tag containing that text. This test holds the rendered DOM to the
 * recorded contract; when the UI changes a tag on purpose, the YAML changes too.
 */
interface Selector {
  text: string;
  role: string;
}

function recordedSelectors(file: string): Selector[] {
  const yaml = readFileSync(file, 'utf8');
  const out: Selector[] = [];
  const re = /selector:\s*\n\s*text:\s*(.+)\n\s*role:\s*(\S+)/g;
  for (const match of yaml.matchAll(re)) {
    out.push({ text: match[1]!.trim(), role: match[2]!.trim() });
  }
  return out;
}

function bets(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `bet-${i}`,
    numbers: [1, 2, 3, 4, 5, 6].map((n) => n + (i % 50)),
    cost: 6,
    type: 'simple' as const,
    numberCount: 6,
    strategy: 'balanced',
  }));
}

function result(count: number) {
  return {
    bets: bets(count),
    totalCost: count * 6,
    remainingBudget: 0,
    budgetUtilization: 100,
    totalNumbers: 60,
    strategy: 'balanced',
    mode: 'simple',
    summary: { simpleBets: count, multipleBets: 0, averageCost: 6 },
  };
}

const normalise = (value: string | null): string => (value ?? '').replace(/\s+/g, ' ').trim();

/** The deepest element carrying the text must have this tag (an ancestor div always "contains" it). */
function hasElement(tag: string, text: string): boolean {
  return Array.from(document.body.querySelectorAll(tag)).some(
    (el) =>
      normalise(el.textContent).includes(text) &&
      !Array.from(el.children).some((child) => normalise(child.textContent).includes(text))
  );
}

const flowsDir = join(process.cwd(), '.argent', 'flows');
const flows = readdirSync(flowsDir).filter((name) => /^qa-generator-.*\.ya?ml$/.test(name));

describe('saved Argent generator flows still match the rendered tags', () => {
  it('finds at least one recorded selector per flow', () => {
    expect(flows.length).toBeGreaterThan(0);
    for (const flow of flows) {
      expect(recordedSelectors(join(flowsDir, flow)).length).toBeGreaterThan(0);
    }
  });

  it.each(flows)('%s', async (flow) => {
    const selectors = recordedSelectors(join(flowsDir, flow));
    const needs200 = selectors.some((s) => s.text.includes('200 apostas'));
    vi.mocked(generateBets).mockResolvedValue(result(needs200 ? 200 : 8) as never);

    render(<GeneratorForm />);

    // Reproduce the flow's input: the budget typed as pt-BR decimals.
    const typed = flow.includes('ptbr') ? '50,50' : '1200';
    fireEvent.change(screen.getByLabelText(/Valor Personalizado/i), { target: { value: typed } });
    fireEvent.click(screen.getByRole('button', { name: /Gerar Apostas/i }));
    await waitFor(() => expect(screen.getByText(/apostas geradas/)).toBeInTheDocument());
    if (needs200) {
      fireEvent.click(screen.getByRole('button', { name: /^Próxima$/ }));
    }

    const missing = selectors
      // The privacy region is rendered by the layout, not the form.
      .filter((s) => s.role !== 'region' && s.role !== 'h1')
      // Page 3 of the pagination flow needs two more clicks; one page is enough to
      // prove the tag contract, so check only the page the test navigated to.
      .filter((s) => !s.text.includes('61 a 80'))
      .filter((s) => !hasElement(s.role, s.text));

    expect(missing, `selectors in ${flow} with no <tag> match`).toEqual([]);
  });
});
