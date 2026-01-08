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

  it('should render about section', () => {
    render(<Footer />);

    expect(screen.getByText(/sobre o projeto/i)).toBeInTheDocument();
    expect(screen.getByText(/ferramenta de an.lise estat.stica/i)).toBeInTheDocument();
  });

  it('should render legal section', () => {
    render(<Footer />);

    expect(screen.getByText(/^legal$/i)).toBeInTheDocument();
  });

  it('should render resources section', () => {
    render(<Footer />);

    expect(screen.getByText(/recursos/i)).toBeInTheDocument();
  });

  it('should render responsible gaming section', () => {
    render(<Footer />);

    expect(screen.getByText(/jogo respons.vel/i)).toBeInTheDocument();
    expect(screen.getByText(/cvv: 188/i)).toBeInTheDocument();
  });

  it('should render disclaimer', () => {
    render(<Footer />);

    expect(screen.getByText(/aviso importante/i)).toBeInTheDocument();
    // Text is split across multiple elements, use partial match
    expect(screen.getByText(/educacional e recreativa/i)).toBeInTheDocument();
  });

  it('should render current year in copyright', () => {
    render(<Footer />);

    expect(screen.getByText(/2025/)).toBeInTheDocument();
    expect(screen.getByText(/mega-sena analyzer/i)).toBeInTheDocument();
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
