import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NumberField } from '@/components/number-field';

describe('NumberField', () => {
  it('renders all sixty cells but exposes only the struck ones to assistive technology', () => {
    render(<NumberField struck={[4, 15, 23, 42, 51, 60]} label="Dezenas do concurso 1" />);
    const list = screen.getByRole('list', { name: 'Dezenas do concurso 1' });
    expect(list.querySelectorAll('li')).toHaveLength(60);
    const exposed = within(list).getAllByRole('listitem');
    expect(exposed.map((li) => li.textContent)).toEqual(['04', '15', '23', '42', '51', '60']);
  });

  it('links struck numbers to their number page without viewport prefetch when linked', () => {
    render(<NumberField struck={[7, 8]} linked label="Dezenas" />);
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/numeros/7', '/numeros/8']);
    expect(links[0]).toHaveAccessibleName('Dezena 07: estatísticas');
  });

  it('renders no links when not linked', () => {
    render(<NumberField struck={[7, 8]} label="Dezenas" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('exposes the ringed reference number even when it is not struck', () => {
    render(<NumberField struck={[1, 2]} ringed={33} label="Companheiras do 33" />);
    const list = screen.getByRole('list', { name: 'Companheiras do 33' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '01',
      '02',
      '33',
    ]);
  });

  it('shows an empty field with every cell hidden from assistive technology', () => {
    render(<NumberField struck={[]} label="Volante vazio" />);
    const list = screen.getByRole('list', { name: 'Volante vazio' });
    expect(within(list).queryAllByRole('listitem')).toHaveLength(0);
    expect(list.querySelectorAll('li')).toHaveLength(60);
  });
});
