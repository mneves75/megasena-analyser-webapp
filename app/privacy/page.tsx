import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Sparkles, Shield, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { JsonLd } from '@/components/seo/json-ld';
import { generateFAQSchema } from '@/lib/seo/schemas';
import { pt } from '@/lib/i18n';
import { BASE_URL as baseUrl } from '@/lib/constants';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: pt.meta.privacy.title,
  description: pt.meta.privacy.description,
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: `${pt.meta.privacy.title} | ${pt.app.name}`,
    description: pt.meta.privacy.openGraphDescription,
    url: '/privacy',
  },
};

type PrivacySection = {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
  note?: string;
  link?: {
    label: string;
    href: string;
    prefix: string;
  };
};

export default function PrivacyPage(): React.JSX.Element {
  const privacyFaqs = pt.privacy.faqs;
  const privacySections = pt.privacy.sections as ReadonlyArray<PrivacySection>;

  return (
    <>
      <JsonLd data={generateFAQSchema(privacyFaqs)} />
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-primary/5">
        <nav className="border-b bg-card/50 backdrop-blur" aria-label="Navegacao do dashboard">
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
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {pt.nav.backToDashboard}
            </Link>
          </Button>
        </div>

        <article className="mx-auto max-w-3xl space-y-6 break-words leading-7 [&_a]:text-primary [&_a]:underline-offset-2 [&_a:hover]:underline [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="mb-0">{pt.privacy.title}</h1>
          </div>

          <p className="text-muted-foreground text-sm">
            {pt.common.lastUpdated}: {pt.privacy.updatedAt}
          </p>

          <div className="not-prose my-8 rounded-xl border-2 border-primary/30 bg-primary/5 p-6 dark:bg-primary/10">
            <p className="font-bold text-primary text-lg mb-2">
              {pt.privacy.summaryTitle}
            </p>
            <p className="text-muted-foreground text-sm">
              {pt.privacy.summaryBody}
            </p>
          </div>

          <div className="not-prose my-6 rounded-lg border border-muted bg-muted/30 p-5">
            <h2 className="mb-3 text-lg font-semibold">{pt.privacy.controllerTitle}</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
              {pt.privacy.controllerRows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="font-medium text-foreground">{row.label}</dt>
                  <dd className="text-muted-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="not-prose my-6 rounded-lg border border-primary/30 bg-primary/5 p-5 dark:bg-primary/10">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <FileCheck aria-hidden className="h-5 w-5 text-primary" />
              {pt.privacy.rightsCtaTitle}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{pt.privacy.rightsCtaBody}</p>
            <Button asChild variant="default" size="sm">
              <Link href={pt.privacy.rightsCtaLinkHref}>{pt.privacy.rightsCtaLinkLabel}</Link>
            </Button>
          </div>

          {privacySections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.note && (
                <p className="text-sm text-muted-foreground">{section.note}</p>
              )}
              {section.link && (
                <p>
                  {section.link.prefix}{' '}
                  <a href={section.link.href} target="_blank" rel="noopener noreferrer">
                    {section.link.label}
                  </a>
                  .
                </p>
              )}
            </section>
          ))}

          <div className="not-prose mt-8 rounded-lg border border-muted bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              {pt.privacy.notice}
            </p>
          </div>
        </article>
      </div>
      </div>
    </>
  );
}
