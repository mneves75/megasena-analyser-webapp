import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import Link from 'next/link';
import { PageTitle, TermRows, proseClass } from '@/app/_components/archive-ui';
import { pt } from '@/lib/i18n';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  path: '/privacy',
  title: pt.meta.privacy.title,
  description: pt.meta.privacy.description,
  socialDescription: pt.meta.privacy.openGraphDescription,
});

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
  const privacySections = pt.privacy.sections as ReadonlyArray<PrivacySection>;

  return (
    <>
      <PageJsonLd
        path="/privacy"
        name={pt.meta.privacy.title}
        description={pt.meta.privacy.description}
      />
      <div className="container mx-auto px-4 py-10">
        <article className={proseClass}>
          <div className="space-y-3">
            <PageTitle>{pt.privacy.title}</PageTitle>
            <p className="text-sm">
              {pt.common.lastUpdated}: {pt.privacy.updatedAt}
            </p>
          </div>

          <p className="text-lg !text-foreground">
            <strong>{pt.privacy.summaryTitle}</strong> {pt.privacy.summaryBody}
          </p>

          <section className="space-y-3">
            <h2>{pt.privacy.controllerTitle}</h2>
            <TermRows
              rows={pt.privacy.controllerRows.map((row) => ({
                term: row.label,
                detail: row.value,
              }))}
            />
          </section>

          <section className="space-y-3">
            <h2>{pt.privacy.rightsCtaTitle}</h2>
            <p>
              {pt.privacy.rightsCtaBody}{' '}
              <Link href={pt.privacy.rightsCtaLinkHref}>{pt.privacy.rightsCtaLinkLabel}</Link>
            </p>
          </section>

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
              {section.note && <p className="text-sm">{section.note}</p>}
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

          <p className="border-t border-border pt-3 text-sm">{pt.privacy.notice}</p>
        </article>
      </div>
    </>
  );
}
