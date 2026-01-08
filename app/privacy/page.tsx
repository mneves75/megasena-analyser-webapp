import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Sparkles, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { JsonLd } from '@/components/seo/json-ld';
import { generateFAQSchema } from '@/lib/seo/schemas';
import { pt } from '@/lib/i18n';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

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
        <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold font-title">
              {pt.app.name}
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/statistics">
                <Button variant="ghost">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  {pt.nav.statistics}
                </Button>
              </Link>
              <Link href="/dashboard/generator">
                <Button variant="default">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {pt.nav.generator}
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {pt.nav.backToDashboard}
            </Link>
          </Button>
        </div>

        <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl">
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
      </main>
      </div>
    </>
  );
}
