import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Sparkles, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { JsonLd } from '@/components/seo/json-ld';
import { generateFAQSchema } from '@/lib/seo/schemas';
import { pt } from '@/lib/i18n';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: pt.meta.terms.title,
  description: pt.meta.terms.description,
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: `${pt.meta.terms.title} | ${pt.app.name}`,
    description: pt.meta.terms.openGraphDescription,
    url: '/terms',
  },
};

type TermsSection = {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

type ResponsibleGamingItem = {
  label: string;
  value: string;
  href?: string;
};

export default function TermsPage(): React.JSX.Element {
  const termsFaqs = pt.terms.faqs;
  const termsSections = pt.terms.sections as ReadonlyArray<TermsSection>;
  const responsibleGamingItems =
    pt.terms.responsibleGaming.items as ReadonlyArray<ResponsibleGamingItem>;

  return (
    <>
      <JsonLd data={generateFAQSchema(termsFaqs)} />
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
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="mb-0">{pt.terms.title}</h1>
          </div>

          <p className="text-muted-foreground text-sm">
            {pt.common.lastUpdated}: {pt.terms.updatedAt}
          </p>

          {/* AVISO PRINCIPAL - O MAIS IMPORTANTE */}
          <div className="not-prose my-8 rounded-xl border-2 border-destructive/30 bg-destructive/10 p-6 dark:bg-destructive/15">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
              <div>
                <p className="font-bold text-destructive text-lg mb-2">
                  {pt.terms.warningTitle}
                </p>
                <p className="text-destructive/90 mb-2">
                  {pt.terms.warningIntro}
                </p>
                <p className="text-destructive/90 text-sm">
                  {pt.terms.warningBody}
                </p>
              </div>
            </div>
          </div>

          {termsSections.map((section) => (
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
            </section>
          ))}

          {/* ISENCAO DE RESPONSABILIDADE */}
          <div className="not-prose my-8 rounded-xl border border-primary/30 bg-primary/5 p-6 dark:bg-primary/10">
            <h3 className="font-bold text-foreground text-lg mb-4">
              {pt.terms.liability.title}
            </h3>
            <p className="text-primary text-sm mb-4 uppercase font-medium">
              {pt.terms.liability.subtitle}
            </p>
            <p className="text-muted-foreground text-sm mb-2">
              <strong>{pt.terms.liability.intro}</strong>
            </p>
            <ul className="text-muted-foreground text-sm space-y-1 list-disc list-inside">
              {pt.terms.liability.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <h2>{pt.terms.responsibleGaming.title}</h2>
          <p>{pt.terms.responsibleGaming.intro}</p>
          <ul>
            {responsibleGamingItems.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>:{' '}
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer">
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </li>
            ))}
          </ul>

          <h2>{pt.terms.changes.title}</h2>
          <p>{pt.terms.changes.body}</p>

          <h2>{pt.terms.law.title}</h2>
          <p>{pt.terms.law.body}</p>

          <div className="not-prose mt-8 rounded-lg border border-muted bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              {pt.terms.closingNote}
            </p>
          </div>
        </article>
      </main>
      </div>
    </>
  );
}
