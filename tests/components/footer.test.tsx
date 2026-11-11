import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/footer';

/**
 * Footer component tests.
 * Verifies:
 * 1. Changelog link is NOT present (removed by design)
 * 2. Terms and Privacy links ARE present
 * 3. Core sections render correctly
 */

describe('Footer - Link Structure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-02'));
  });

  it('should NOT render changelog link', () => {
    render(<Footer />);

    // Changelog link should NOT exist
    const changelogLink = screen.queryByRole('link', { name: /changelog/i });
    expect(changelogLink).toBeNull();

    // Also verify by href
    const allLinks = screen.getAllByRole('link');
    const changelogHref = allLinks.find((link) => link.getAttribute('href') === '/changelog');
    expect(changelogHref).toBeUndefined();
  });

  it('should render terms link', () => {
    render(<Footer />);

    const termsLink = screen.getByRole('link', { name: /termos de servi/i });
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('should render privacy link', () => {
    render(<Footer />);

    const privacyLink = screen.getByRole('link', { name: /pol.tica de privacidade/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('should render dashboard link', () => {
    render(<Footer />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });
});

describe('Footer - Core Sections', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-02'));
  });

  it('has three rows: links, responsible gaming, disclaimer with copyright and version', () => {
    const { container } = render(<Footer />);
    const shell = container.querySelector('footer > .page') as HTMLElement;
    expect(shell.children).toHaveLength(3);
    expect(shell.children[0]?.querySelectorAll('nav')).toHaveLength(2);
    expect(shell.children[1]).toHaveTextContent(/cvv: 188/i);
    expect(shell.children[2]).toHaveTextContent(/© 2025 Mega-Sena Analyzer/);
    expect(shell.children[2]).toHaveTextContent(/^.*v\d+\.\d+\.\d+/);
  });

  it('labels its landmarks without adding headings to the page outline', () => {
    const { container } = render(<Footer />);
    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
    expect(screen.queryByText(/ferramenta de an.lise estat.stica/i)).toBeNull();
  });

  it('should render legal section', () => {
    render(<Footer />);

    expect(screen.getByRole('navigation', { name: /^legal$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sobre o projeto/i })).toHaveAttribute(
      'href',
      '/about'
    );
  });

  it('should render resources section', () => {
    render(<Footer />);

    expect(screen.getByRole('navigation', { name: /recursos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resultados/i })).toHaveAttribute(
      'href',
      '/resultados'
    );
  });

  it('should render responsible gaming section', () => {
    render(<Footer />);

    expect(screen.getByRole('region', { name: /jogo respons.vel/i })).toBeInTheDocument();
    expect(screen.getByText(/proibidas para menores de 18 anos/i)).toBeInTheDocument();
    expect(screen.getByText(/cvv: 188/i)).toBeInTheDocument();
  });

  it('should render disclaimer', () => {
    render(<Footer />);

    expect(screen.getByText('Aviso')).toBeInTheDocument();
    // Text is split across multiple elements, use partial match
    expect(screen.getByText(/educacional e recreativa/i)).toBeInTheDocument();
  });

  it('should render current year in copyright', () => {
    render(<Footer />);

    expect(screen.getByText(/© 2025 Mega-Sena Analyzer/i)).toBeInTheDocument();
  });
});

describe('Footer - External Links', () => {
  it('should render jogadores anonimos link with proper attributes', () => {
    render(<Footer />);

    const jaLink = screen.getByRole('link', { name: /jogadores an.nimos/i });
    expect(jaLink).toHaveAttribute('href', 'https://www.jogadoresanonimos.com.br');
    expect(jaLink).toHaveAttribute('target', '_blank');
    expect(jaLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
