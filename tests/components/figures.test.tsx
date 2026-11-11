import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Bar, Columns } from '@/components/figures';

const rects = (root: Element): SVGRectElement[] => Array.from(root.querySelectorAll('rect'));

describe('Bar', () => {
  it('draws the value as a share of the column maximum', () => {
    const { container } = render(<Bar value={250} max={500} />);
    const [track, fill] = rects(container);
    expect(track?.getAttribute('width')).toBe('100');
    expect(fill?.getAttribute('width')).toBe('50');
  });

  it('stays inside its track for values beyond the maximum, below zero, or with no maximum', () => {
    const widthOf = (value: number, max: number): string | null | undefined =>
      rects(render(<Bar value={value} max={max} />).container)[1]?.getAttribute('width');
    expect(widthOf(900, 500)).toBe('100');
    expect(widthOf(-3, 500)).toBe('0');
    expect(widthOf(10, 0)).toBe('0');
  });

  it('is hidden from assistive technology: the number is already in the row', () => {
    const { container } = render(<Bar value={1} max={2} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Columns', () => {
  const parity = [
    { label: '2 / 4', value: 20, detail: '20,0%' },
    { label: '3 / 3', value: 40, detail: '40,0%' },
    { label: '4 / 2', value: 10, detail: '10,0%' },
  ];

  it('scales every column from a zero baseline against the tallest one', () => {
    render(<Columns columns={parity} label="Concursos por quantidade de pares" />);
    const plot = screen.getByRole('img', { name: 'Concursos por quantidade de pares' });
    expect(rects(plot).map((rect) => rect.getAttribute('height'))).toEqual(['50', '100', '25']);
    expect(rects(plot).map((rect) => rect.getAttribute('y'))).toEqual(['50', '0', '75']);
  });

  it('scales against the reference when it is above every column, and draws it', () => {
    render(
      <Columns
        columns={parity}
        reference={{ value: 80, label: 'Média esperada: 80' }}
        label="Com referência"
      />
    );
    const plot = screen.getByRole('img', { name: 'Com referência' });
    expect(rects(plot).map((rect) => rect.getAttribute('height'))).toEqual(['25', '50', '12.5']);
    const line = plot.querySelector('line');
    expect(line?.getAttribute('y1')).toBe('0');
    expect(screen.getByText('Média esperada: 80')).toBeInTheDocument();
  });

  it('prints each label with its figure, and no label row when every label is empty', () => {
    const { unmount } = render(<Columns columns={parity} label="Rotulado" />);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText('40,0%')).toBeInTheDocument();
    unmount();
    const { container } = render(
      <Columns columns={parity.map((column) => ({ value: column.value, label: '' }))} label="Sem" />
    );
    expect(container.querySelector('ol')).toBeNull();
  });

  it('draws nothing tall for an all-zero distribution instead of dividing by zero', () => {
    render(<Columns columns={[{ label: 'a', value: 0 }]} label="Vazio" />);
    const plot = screen.getByRole('img', { name: 'Vazio' });
    expect(rects(plot).map((rect) => rect.getAttribute('height'))).toEqual(['0']);
  });

  it('gives no svg any React child, so React can never stream a piece of a figure on its own', () => {
    // A deferred chunk inside <svg> is streamed as <svg style="display:none">, which the CSP refuses.
    const svgs = (node: unknown): { props: Record<string, unknown> }[] => {
      if (Array.isArray(node)) return node.flatMap(svgs);
      if (!node || typeof node !== 'object' || !('props' in node)) return [];
      const element = node as { type: unknown; props: Record<string, unknown> };
      return [...(element.type === 'svg' ? [element] : []), ...svgs(element.props['children'])];
    };
    const found = [
      ...svgs(Bar({ value: 1, max: 3 })),
      ...svgs(Columns({ columns: parity, reference: { value: 30, label: 'ref' }, label: 'x' })),
    ];
    expect(found).toHaveLength(3);
    for (const svg of found) {
      expect(svg.props['children']).toBeUndefined();
      expect(svg.props['dangerouslySetInnerHTML']).toEqual({ __html: expect.any(String) });
    }
  });

  it('never emits a style attribute: the CSP has no style-src-attr exception', () => {
    const { container } = render(
      <>
        <Bar value={1} max={3} />
        <Columns columns={parity} reference={{ value: 30, label: 'ref' }} label="CSP" />
      </>
    );
    expect(container.innerHTML).not.toMatch(/\sstyle=/);
  });
});
