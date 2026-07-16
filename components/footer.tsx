import Link from 'next/link';
import { APP_INFO } from '@/lib/constants';
import { AlertTriangle } from 'lucide-react';
import { pt } from '@/lib/i18n';

export function Footer(): React.JSX.Element {
  const currentYear = new Date().getFullYear();

  const linkClass =
    'text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm';

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
          {/* About Section */}
          <div className="space-y-3">
            <p className="font-title text-base font-bold tracking-tight text-foreground">
              {APP_INFO.NAME}
            </p>
            <p className="max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
              {pt.footer.aboutText}
            </p>
          </div>

          {/* Legal Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {pt.footer.legalTitle}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/terms" className={linkClass}>
                  {pt.footer.termsLink}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={linkClass}>
                  {pt.footer.privacyLink}
                </Link>
              </li>
              <li>
                <Link href="/privacy/direitos" className={linkClass}>
                  {pt.footer.rightsLink}
                </Link>
              </li>
              <li>
                <Link href="/about" className={linkClass}>
                  Sobre o Projeto
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {pt.footer.resourcesTitle}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/dashboard" className={linkClass}>
                  {pt.nav.dashboard}
                </Link>
              </li>
              <li>
                <Link href="/dashboard/statistics" className={linkClass}>
                  {pt.nav.statistics}
                </Link>
              </li>
              <li>
                <Link href="/dashboard/generator" className={linkClass}>
                  {pt.nav.generator}
                </Link>
              </li>
            </ul>
          </div>

          {/* Responsible Gaming Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {pt.footer.responsibleGamingTitle}
            </h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="leading-relaxed">{pt.footer.responsibleGamingText}</p>
              <div className="space-y-1 text-xs leading-relaxed">
                <p className="font-medium text-foreground">{pt.footer.helpTitle}</p>
                <p>{pt.footer.helpContact}</p>
                <p>
                  <a
                    href="https://www.jogadoresanonimos.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline underline-offset-4 ${linkClass}`}
                  >
                    {pt.footer.helpLinkLabel}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 border-t border-border pt-8">
          <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-destructive" />
              {pt.footer.disclaimerTitle}
            </p>
            <p className="max-w-[80ch]">{pt.footer.disclaimerBody}</p>
            <p className="max-w-[80ch]">{pt.footer.disclaimerSource}</p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-border pt-6">
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground md:flex-row">
            <p>
              © {currentYear} {APP_INFO.NAME}. {pt.footer.rightsReservedPrefix}
            </p>
            <div className="flex items-center gap-3">
              <span>{pt.footer.developedWith}</span>
              <span aria-hidden className="hidden text-border md:inline">
                •
              </span>
              <span className="hidden md:inline">{pt.footer.compliance}</span>
              <span aria-hidden className="hidden text-border md:inline">
                •
              </span>
              <span className="tabular-nums">v{APP_INFO.VERSION}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
