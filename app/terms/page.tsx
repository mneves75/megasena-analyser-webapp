import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { PageTitle, TermRows, proseClass } from '@/app/_components/archive-ui';
import { pt } from '@/lib/i18n';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  path: '/terms',
  title: pt.meta.terms.title,
  description: pt.meta.terms.description,
  socialDescription: pt.meta.terms.openGraphDescription,
});

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
  const termsSections = pt.terms.sections as ReadonlyArray<TermsSection>;
  const responsibleGamingItems = pt.terms.responsibleGaming
    .items as ReadonlyArray<ResponsibleGamingItem>;

  return (
    <>
      <PageJsonLd
        path="/terms"
        name={pt.meta.terms.title}
        description={pt.meta.terms.description}
      />
      <div className="container mx-auto px-4 py-10">
        <article className={proseClass}>
          <div className="space-y-3">
            <PageTitle>{pt.terms.title}</PageTitle>
            <p className="text-sm">
              {pt.common.lastUpdated}: {pt.terms.updatedAt}
            </p>
          </div>

          <section
            aria-labelledby="terms-warning"
            className="space-y-2 border-t-2 border-destructive pt-4"
          >
            <p id="terms-warning" className="font-title text-xl font-semibold !text-destructive">
              {pt.terms.warningTitle}
            </p>
            <p className="!text-foreground">{pt.terms.warningIntro}</p>
            <p>{pt.terms.warningBody}</p>
          </section>

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

          <section className="space-y-3">
            <h2>{pt.terms.liability.title}</h2>
            <p className="!text-foreground">{pt.terms.liability.subtitle}</p>
            <p>{pt.terms.liability.intro}</p>
            <ul className="text-muted-foreground">
              {pt.terms.liability.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <h2>{pt.terms.responsibleGaming.title}</h2>
          <p>{pt.terms.responsibleGaming.intro}</p>
          <TermRows
            rows={responsibleGamingItems.map((item) => ({
              term: item.label,
              detail: item.href ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.value}
                </a>
              ) : (
                item.value
              ),
            }))}
          />

          <h2>{pt.terms.changes.title}</h2>
          <p>{pt.terms.changes.body}</p>

          <h2>{pt.terms.law.title}</h2>
          <p>{pt.terms.law.body}</p>

          <p className="border-t border-border pt-3 text-sm">{pt.terms.closingNote}</p>
        </article>
      </div>
    </>
  );
}
