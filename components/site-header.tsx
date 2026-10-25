'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pt } from '@/lib/i18n';
import { ThemeToggle } from '@/components/theme-toggle';

interface NavLink {
  href: string;
  label: string;
  /** Other sections that belong to this entry, e.g. each draw page under Resultados. */
  alsoActiveOn?: readonly string[];
  /**
   * Archive routes render fully on prefetch (no loading boundary) and would
   * spend one API call per page view, so they are fetched only on click.
   */
  prefetch?: false;
}

const NAV_LINKS: readonly NavLink[] = [
  { href: '/resultados', label: pt.nav.results, alsoActiveOn: ['/concurso'], prefetch: false },
  { href: '/numeros', label: pt.nav.numbers, prefetch: false },
  { href: '/dashboard', label: pt.nav.dashboard },
  { href: '/dashboard/statistics', label: pt.nav.statistics },
  { href: '/dashboard/generator', label: pt.nav.generator },
  { href: '/about', label: 'Sobre' },
] as const;

function isLinkActive(pathname: string, link: NavLink): boolean {
  return (
    isActivePath(pathname, link.href) ||
    (link.alsoActiveOn ?? []).some((href) => isActivePath(pathname, href))
  );
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader(): React.JSX.Element {
  const pathname = usePathname() ?? '/';
  const [menuOpen, setMenuOpen] = useState(false);

  // The mobile menu is a disclosure, not a modal, so the expected escape is a
  // keyboard dismissal and a reset when the route changes by any means.
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-sm font-title text-lg font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [font-stretch:88%]"
        >
          <span aria-hidden className="grid grid-cols-3 gap-0.5">
            {[0, 1, 2, 3, 4, 5].map((dot) => (
              <span key={dot} className="h-1.5 w-1.5 rounded-full bg-primary" />
            ))}
          </span>
          Mega-Sena Analyzer
        </Link>

        <nav className="hidden h-full items-stretch gap-1 lg:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(pathname, link);
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={link.prefetch ?? null}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {link.label}
                {active && (
                  <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            aria-controls="site-header-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="site-header-mobile-menu"
          aria-label="Navegação principal"
          className="border-t border-border bg-background lg:hidden"
        >
          <ul className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(pathname, link);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch={link.prefetch ?? null}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex min-h-11 items-center py-2.5 text-sm font-medium underline-offset-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      active
                        ? 'text-foreground underline decoration-primary decoration-2'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
