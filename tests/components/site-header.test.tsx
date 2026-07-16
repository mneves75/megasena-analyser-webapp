import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * SiteHeader active-link tests.
 *
 * Two layers:
 * 1. Unit tests for the pure isActivePath(pathname, href) matcher.
 * 2. Integration render assertions that the matcher drives aria-current="page"
 *    on the correct nav link (usePathname is mocked; ThemeToggle is stubbed to
 *    avoid pulling in the theme provider / window.matchMedia).
 *
 * Behavioural contract encoded here:
 * - The "/dashboard" link is active ONLY on exactly "/dashboard", never on its
 *   children, because /dashboard/statistics and /dashboard/generator are
 *   siblings that would otherwise all light up the Dashboard link.
 * - Every other href is active on an exact match OR on any nested sub-route.
 */

const mockUsePathname = vi.fn<() => string | null>(() => '/');

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => null,
}));

import { SiteHeader, isActivePath } from '@/components/site-header';

describe('isActivePath', () => {
  it('marks the exact route as active', () => {
    expect(isActivePath('/dashboard/statistics', '/dashboard/statistics')).toBe(true);
  });

  it('marks a nested sub-route as active for its parent link', () => {
    expect(isActivePath('/dashboard/statistics/detalhes', '/dashboard/statistics')).toBe(true);
  });

  it('does not mark a sibling link active (/dashboard/statistics vs /dashboard/generator)', () => {
    expect(isActivePath('/dashboard/statistics', '/dashboard/generator')).toBe(false);
  });

  it('keeps the /dashboard link active only on exactly /dashboard, not on its children', () => {
    expect(isActivePath('/dashboard', '/dashboard')).toBe(true);
    expect(isActivePath('/dashboard/statistics', '/dashboard')).toBe(false);
    expect(isActivePath('/dashboard/generator', '/dashboard')).toBe(false);
  });

  it('marks home "/" active only on "/"', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/dashboard', '/')).toBe(false);
    expect(isActivePath('/about', '/')).toBe(false);
  });

  it('does not treat a prefix that is not a path segment as a sub-route', () => {
    // "/dashboard-x" must not match the "/dashboard" special case nor a sub-route.
    expect(isActivePath('/dashboard-extra', '/dashboard')).toBe(false);
    expect(isActivePath('/about-us', '/about')).toBe(false);
  });
});

describe('SiteHeader active link rendering', () => {
  function currentPageHrefs(): string[] {
    return screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.getAttribute('href') ?? '');
  }

  it('marks only the Dashboard link on exactly /dashboard', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    render(<SiteHeader />);

    expect(currentPageHrefs()).toEqual(['/dashboard']);
  });

  it('marks only the Statistics link on /dashboard/statistics (not Dashboard, not Generator)', () => {
    mockUsePathname.mockReturnValue('/dashboard/statistics');
    render(<SiteHeader />);

    expect(currentPageHrefs()).toEqual(['/dashboard/statistics']);
  });

  it('marks the Statistics link active on a nested statistics sub-route', () => {
    mockUsePathname.mockReturnValue('/dashboard/statistics/detalhes');
    render(<SiteHeader />);

    expect(currentPageHrefs()).toEqual(['/dashboard/statistics']);
  });

  it('marks no nav link when pathname is home "/"', () => {
    mockUsePathname.mockReturnValue('/');
    render(<SiteHeader />);

    expect(currentPageHrefs()).toEqual([]);
  });
});
