import Link from 'next/link';
import { APP_INFO } from '@/lib/constants';
import { pt } from '@/lib/i18n';

const linkClass =
  'rounded-sm text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const ROW = 'grid gap-2 py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8';
const LABEL = 'text-sm font-semibold text-foreground';
const LINKS = 'flex flex-wrap gap-x-5 gap-y-2 text-sm';

const ARCHIVE_LINKS = [
  { href: '/resultados', label: pt.nav.results, archive: true },
  { href: '/numeros', label: pt.nav.numbersFull, archive: true },
  { href: '/mega-da-virada', label: pt.nav.megaDaVirada, archive: true },
  { href: '/dashboard', label: pt.nav.dashboard, archive: false },
  { href: '/dashboard/statistics', label: pt.nav.statistics, archive: false },
  { href: '/dashboard/generator', label: pt.nav.generator, archive: false },
] as const;

const LEGAL_LINKS = [
  { href: '/terms', label: pt.footer.termsLink },
  { href: '/privacy', label: pt.footer.privacyLink },
  { href: '/privacy/direitos', label: pt.footer.rightsLink },
  { href: '/about', label: pt.footer.aboutLink },
] as const;

export function Footer(): React.JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-primary bg-background">
      <div className="container mx-auto px-4 py-10">
        <div className={`${ROW} pt-0`}>
          <p className="font-title text-base font-semibold text-foreground [font-stretch:88%]">
            {APP_INFO.NAME}
          </p>
          <p className="max-w-[68ch] text-sm text-muted-foreground">{pt.footer.aboutText}</p>
        </div>

        <div className="divide-y divide-border border-y border-border">
          <nav aria-labelledby="footer-resources" className={ROW}>
            <h2 id="footer-resources" className={LABEL}>
              {pt.footer.resourcesTitle}
            </h2>
            <ul className={LINKS}>
              {ARCHIVE_LINKS.map((link) => (
                <li key={link.href}>
                  {/* Archive pages are full data renders: no viewport prefetch. */}
                  <Link
                    href={link.href}
                    {...(link.archive ? { prefetch: false } : {})}
                    className={linkClass}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal" className={ROW}>
            <h2 id="footer-legal" className={LABEL}>
              {pt.footer.legalTitle}
            </h2>
            <ul className={LINKS}>
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="footer-responsible" className={ROW}>
            <h2 id="footer-responsible" className={LABEL}>
              {pt.footer.responsibleGamingTitle}
            </h2>
            <div className="space-y-2 text-sm">
              <ul className={LINKS}>
                <li className="text-foreground">{pt.footer.helpContact}</li>
                <li>
                  <a
                    href="https://www.jogadoresanonimos.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {pt.footer.helpLinkLabel}
                  </a>
                </li>
                <li>
                  <a
                    href={pt.footer.officialHelpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {pt.footer.officialHelpLabel}
                  </a>
                </li>
              </ul>
              <p className="font-medium text-foreground">{pt.footer.minorsNotice}</p>
            </div>
          </section>

          <section aria-labelledby="footer-disclaimer" className={ROW}>
            <h2 id="footer-disclaimer" className={LABEL}>
              {pt.footer.disclaimerTitle}
            </h2>
            <div className="max-w-[68ch] space-y-2 text-sm text-muted-foreground">
              <p>{pt.footer.disclaimerBody}</p>
              <p>{pt.footer.disclaimerSource}</p>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-2 pt-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            © {currentYear} {APP_INFO.NAME}. {pt.footer.rightsReservedPrefix}
          </p>
          <p className="tabular-nums">v{APP_INFO.VERSION}</p>
        </div>
      </div>
    </footer>
  );
}
