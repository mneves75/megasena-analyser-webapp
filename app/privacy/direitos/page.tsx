import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { PageTitle, TermRows, proseClass } from '@/app/_components/archive-ui';
import { RightsRequestTemplate } from '@/components/privacy/rights-request-template';
import { pt } from '@/lib/i18n';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  path: '/privacy/direitos',
  title: pt.meta.privacyRights.title,
  description: pt.meta.privacyRights.description,
  socialDescription: pt.meta.privacyRights.openGraphDescription,
});

const PRIVACY_CHANNEL = pt.privacyRights.channelValue;

export default function PrivacyRightsPage(): React.JSX.Element {
  return (
    <div className="container mx-auto px-4 py-10">
      <PageJsonLd
        path="/privacy/direitos"
        name={pt.meta.privacyRights.title}
        description={pt.meta.privacyRights.description}
      />
      <article className={proseClass}>
        <div className="space-y-3">
          <PageTitle>{pt.privacyRights.title}</PageTitle>
          <p className="text-sm">
            {pt.common.lastUpdated}: {pt.privacyRights.updatedAt}
          </p>
        </div>
        <p className="text-lg !text-foreground">{pt.privacyRights.subtitle}</p>

        <section className="space-y-3">
          <h2>{pt.privacyRights.introTitle}</h2>
          <p>{pt.privacyRights.introBody}</p>
          <p className="!text-foreground">
            {pt.privacyRights.channelLabel}:{' '}
            <a href={`mailto:${PRIVACY_CHANNEL}?subject=Solicita%C3%A7%C3%A3o%20LGPD`}>
              {PRIVACY_CHANNEL}
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2>{pt.privacyRights.rightsTitle}</h2>
          <TermRows
            rows={pt.privacyRights.rights.map((right) => ({
              term: right.title,
              detail: (
                <>
                  {right.description}{' '}
                  <span className="whitespace-nowrap text-xs">({right.legalRef})</span>
                </>
              ),
            }))}
          />
        </section>

        <section className="space-y-3">
          <h2>{pt.privacyRights.howTitle}</h2>
          <ol>
            {pt.privacyRights.howSteps.map((step) => (
              <li key={step}>{step}</li>
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

        <section className="space-y-3">
          <h2>{pt.privacyRights.anpdTitle}</h2>
          <p>{pt.privacyRights.anpdBody}</p>
          <p>
            <a href={pt.privacyRights.anpdLinkHref} target="_blank" rel="noopener noreferrer">
              {pt.privacyRights.anpdLinkLabel}
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2>{pt.privacyRights.legalRefTitle}</h2>
          <p>{pt.privacyRights.legalRefBody}</p>
        </section>
      </article>
    </div>
  );
}
