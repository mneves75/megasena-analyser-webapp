import Link from 'next/link';
import { APP_INFO } from '@/lib/constants';
import { AlertTriangle } from 'lucide-react';
import { pt } from '@/lib/i18n';

export function Footer(): React.JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* About Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{pt.footer.aboutTitle}</h3>
            <p className="text-sm text-muted-foreground">{pt.footer.aboutText}</p>
          </div>

          {/* Legal Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{pt.footer.legalTitle}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {pt.footer.termsLink}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {pt.footer.privacyLink}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{pt.footer.resourcesTitle}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/dashboard"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {pt.nav.dashboard}
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/statistics"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {pt.nav.statistics}
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/generator"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {pt.nav.generator}
                </Link>
              </li>
            </ul>
          </div>

          {/* Responsible Gaming Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{pt.footer.responsibleGamingTitle}</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{pt.footer.responsibleGamingText}</p>
              <div className="space-y-1 text-xs">
                <p className="font-medium text-foreground">{pt.footer.helpTitle}</p>
                <p>{pt.footer.helpContact}</p>
                <p>
                  <a
                    href="https://www.jogadoresanonimos.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    {pt.footer.helpLinkLabel}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 border-t pt-6">
          <div className="space-y-3 text-xs text-muted-foreground">
            <p className="font-medium text-destructive flex items-center gap-2">
              <AlertTriangle aria-hidden className="h-4 w-4 text-destructive" />
              {pt.footer.disclaimerTitle}
            </p>
            <p>{pt.footer.disclaimerBody}</p>
            <p>{pt.footer.disclaimerSource}</p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-6 border-t pt-6">
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground md:flex-row">
            <p>
              © {currentYear} {APP_INFO.NAME}. {pt.footer.rightsReservedPrefix}
            </p>
            <div className="flex items-center gap-4">
              <p>{pt.footer.developedWith}</p>
              <span className="hidden md:inline">•</span>
              <p className="hidden md:inline">{pt.footer.compliance}</p>
              <span className="hidden md:inline">•</span>
              <p>v{APP_INFO.VERSION}</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
