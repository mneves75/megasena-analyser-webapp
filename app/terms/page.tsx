import type { Metadata } from 'next';
import { FileText, AlertTriangle } from 'lucide-react';
import { JsonLd } from '@/components/seo/json-ld';
import { generateFAQSchema } from '@/lib/seo/schemas';
import { pt } from '@/lib/i18n';
import { BASE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
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
      <div className="container mx-auto px-4 py-8">
        <article className="mx-auto max-w-[70ch] space-y-6 break-words leading-7 [&_a:hover]:underline [&_a]:text-primary [&_a]:underline-offset-2 [&_h1]:text-balance [&_h1]:font-title [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-balance [&_h2]:font-title [&_h2]:text-xl [&_h2]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6">
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
      </div>
    </>
  );
}
