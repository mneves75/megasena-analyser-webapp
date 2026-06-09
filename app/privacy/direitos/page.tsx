import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BarChart3, FileCheck, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { RightsRequestTemplate } from '@/components/privacy/rights-request-template';
import { pt } from '@/lib/i18n';
import { BASE_URL as baseUrl } from '@/lib/constants';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: pt.meta.privacyRights.title,
  description: pt.meta.privacyRights.description,
  alternates: {
    canonical: '/privacy/direitos',
  },
  openGraph: {
    title: `${pt.meta.privacyRights.title} | ${pt.app.name}`,
    description: pt.meta.privacyRights.openGraphDescription,
    url: '/privacy/direitos',
  },
};

const PRIVACY_CHANNEL = pt.privacyRights.channelValue;

export default function PrivacyRightsPage(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b bg-card/50 backdrop-blur" aria-label="Navegação do dashboard">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="min-w-0 truncate text-lg font-bold font-title sm:text-2xl">
              {pt.app.name}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="ghost">
                <Link href="/dashboard/statistics" aria-label={pt.nav.statistics}>
                  <BarChart3 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{pt.nav.statistics}</span>
                </Link>
              </Button>
              <Button asChild variant="default">
                <Link href="/dashboard/generator" aria-label={pt.nav.generator}>
                  <Sparkles className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{pt.nav.generator}</span>
                </Link>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto flex-1 px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link href="/privacy" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {pt.nav.backToPrivacy}
            </Link>
          </Button>
        </div>

        <article className="mx-auto max-w-3xl space-y-6 break-words leading-7 [&_a]:text-primary [&_a]:underline-offset-2 [&_a:hover]:underline [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6">
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="mb-0">{pt.privacyRights.title}</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {pt.common.lastUpdated}: {pt.privacyRights.updatedAt}
          </p>
          <p className="text-muted-foreground">{pt.privacyRights.subtitle}</p>

          <div className="not-prose my-6 rounded-lg border border-primary/30 bg-primary/5 p-5 dark:bg-primary/10">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Mail aria-hidden className="h-5 w-5 text-primary" />
              {pt.privacyRights.introTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{pt.privacyRights.introBody}</p>
            <p className="mt-3 text-sm">
              <span className="font-medium">{pt.privacyRights.channelLabel}:</span>{' '}
              <a
                href={`mailto:${PRIVACY_CHANNEL}?subject=Solicita%C3%A7%C3%A3o%20LGPD`}
                className="underline-offset-2 hover:underline"
              >
                {PRIVACY_CHANNEL}
              </a>
            </p>
          </div>

          <section className="not-prose my-8 space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <FileCheck aria-hidden className="h-5 w-5 text-primary" />
              {pt.privacyRights.rightsTitle}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {pt.privacyRights.rights.map((right) => (
                <li
                  key={right.legalRef}
                  className="rounded-lg border border-muted bg-card/50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {right.legalRef}
                  </p>
                  <p className="mt-1 font-medium text-foreground">{right.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{right.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="not-prose my-8 space-y-3">
            <h2 className="text-xl font-semibold">{pt.privacyRights.howTitle}</h2>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {pt.privacyRights.howSteps.map((step, idx) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <RightsRequestTemplate
            title={pt.privacyRights.templateTitle}
            body={pt.privacyRights.templateBody}
            copyLabel={pt.privacyRights.copyTemplate}
            copiedLabel={pt.privacyRights.copiedTemplate}
            channel={PRIVACY_CHANNEL}
          />

          <section className="not-prose my-8 rounded-lg border border-muted bg-muted/30 p-5">
            <h2 className="mb-2 text-lg font-semibold">{pt.privacyRights.anpdTitle}</h2>
            <p className="text-sm text-muted-foreground">{pt.privacyRights.anpdBody}</p>
            <p className="mt-3 text-sm">
              <a
                href={pt.privacyRights.anpdLinkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {pt.privacyRights.anpdLinkLabel}
              </a>
            </p>
          </section>

          <section className="not-prose my-8 rounded-lg border border-muted bg-muted/30 p-5">
            <h2 className="mb-2 text-lg font-semibold">{pt.privacyRights.legalRefTitle}</h2>
            <p className="text-sm text-muted-foreground">{pt.privacyRights.legalRefBody}</p>
          </section>
        </article>
      </div>
    </div>
  );
}
