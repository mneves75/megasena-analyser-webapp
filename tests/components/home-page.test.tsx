import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import HomePage from '@/app/(home)/page';

vi.mock('@/components/seo/page-json-ld', () => ({ PageJsonLd: () => null }));
vi.mock('@/lib/api/forwarded-client-ip', () => ({ forwardedClientIpHeaders: async () => ({}) }));

const fetchApi = vi.fn();
vi.mock('@/lib/api/api-fetch', () => ({ fetchApi: (...args: unknown[]) => fetchApi(...args) }));

const snapshot = {
  statistics: { lastContestNumber: 3006 },
  recentDraws: [
    {
      contestNumber: 3006,
      drawDate: '2026-05-12',
      numbers: [4, 15, 23, 42, 51, 60],
      prizeSena: 0,
      accumulated: true,
    },
  ],
};

const TITLE = 'Resultados e estatísticas da Mega-Sena desde 1996';

describe('HomePage', () => {
  beforeEach(() => {
    fetchApi.mockReset();
    fetchApi.mockResolvedValue(Response.json(snapshot));
  });

  it('opens on the latest draw: the title, its facts, the field of sixty and the actions', async () => {
    const { container } = render(await HomePage());
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const hero = within(header as HTMLElement);

    expect(hero.getByRole('heading', { level: 1 })).toHaveTextContent(TITLE);
    // The game's name never breaks at its hyphen when the title wraps.
    expect(within(hero.getByRole('heading', { level: 1 })).getByText('Mega-Sena')).toHaveClass(
      'whitespace-nowrap'
    );
    expect(hero.getByText('Concurso 3006, sorteado em 12/05/2026')).toBeInTheDocument();
    expect(hero.getByText('Acumulou')).toBeInTheDocument();
    expect(hero.getByRole('link', { name: /concurso 3006/ })).toHaveAttribute(
      'href',
      '/concurso/3006'
    );
    expect(
      hero.getByRole('list', { name: 'Dezenas sorteadas no concurso 3006' })
    ).toBeInTheDocument();
    expect(hero.getByRole('link', { name: 'Acessar Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(hero.getByRole('link', { name: 'Gerar apostas' })).toHaveAttribute(
      'href',
      '/dashboard/generator'
    );
  });

  it('reads title, facts, field, actions in that order (the phone order)', async () => {
    const { container } = render(await HomePage());
    const header = container.querySelector('header') as HTMLElement;
    const order = [
      within(header).getByRole('heading', { level: 1 }),
      within(header).getByText('Concurso 3006, sorteado em 12/05/2026'),
      within(header).getByRole('list', { name: 'Dezenas sorteadas no concurso 3006' }),
      within(header).getByRole('link', { name: 'Acessar Dashboard' }),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  it('states its source once, in the hero', async () => {
    const { container } = render(await HomePage());
    expect(container.textContent?.match(/Fonte: CAIXA/g)).toHaveLength(1);
    expect(container.querySelector('header')).toHaveTextContent(/Fonte: CAIXA/);
  });

  it('drops the lead paragraph and the "Neste site" link list', async () => {
    render(await HomePage());
    expect(screen.queryByText(/Todos os concursos desde 1996 com os dados oficiais/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Neste site' })).toBeNull();
  });

  it('keeps one note, below the hero, and the FAQ and "O que é" blocks', async () => {
    const { container } = render(await HomePage());
    const notes = screen.getAllByText('Nota.');
    expect(notes).toHaveLength(1);
    const header = container.querySelector('header') as HTMLElement;
    const field = within(header).getByRole('list', { name: /Dezenas sorteadas/ });
    expect(
      field.compareDocumentPosition(notes[0]!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'O que é o Mega-Sena Analyzer?' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Perguntas frequentes' })).toBeVisible();
  });

  it('marks the page complete for the edge cache exactly once when the snapshot loads', async () => {
    const { container } = render(await HomePage());
    expect(container.querySelectorAll('[data-edge-cache="complete"]')).toHaveLength(1);
  });

  it.each([
    ['the API is unreachable', () => fetchApi.mockRejectedValue(new Error('offline'))],
    ['the API answers an error', () => fetchApi.mockResolvedValue(new Response('down', { status: 503 }))],
  ])('renders no edge-cache marker when %s (the empty fallback must not be stored)', async (_case, fail) => {
    fail();
    const { container } = render(await HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(TITLE);
    expect(container.querySelector('[data-edge-cache]')).toBeNull();
  });

  it('keeps the title and the actions when the latest draw is unavailable', async () => {
    fetchApi.mockRejectedValue(new Error('offline'));
    render(await HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(TITLE);
    expect(screen.getByRole('link', { name: 'Acessar Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Resultados' })).toHaveAttribute('href', '/resultados');
  });
});
