import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { ChevronDown } from 'lucide-react';
import { GeneratorForm } from './generator-form';
import { pt } from '@/lib/i18n';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { PageTitle } from '@/app/_components/archive-ui';

export const metadata: Metadata = buildPageMetadata({
  path: '/dashboard/generator',
  title: pt.meta.generator.title,
  description: pt.meta.generator.description,
  socialDescription: pt.meta.generator.openGraphDescription,
});

export default function GeneratorPage() {
  return (
    <div>
      <PageJsonLd
        path="/dashboard/generator"
        name={pt.meta.generator.title}
        description={pt.meta.generator.description}
        breadcrumbs={[
          { name: 'Início', url: '/' },
          { name: 'Dashboard', url: '/dashboard' },
          { name: 'Gerador de Apostas', url: '/dashboard/generator' },
        ]}
      />

      <header className="mb-6 max-w-2xl">
        <PageTitle>{pt.generatorPage.title}</PageTitle>
        <p className="mt-2 text-muted-foreground">{pt.generatorPage.subtitle}</p>
      </header>

      <details className="group mb-8 max-w-3xl border-y border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-sm font-medium text-foreground transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <span>
            <span className="font-semibold">Nota.</span> Prever o resultado da loteria é
            estatisticamente impossível.
          </span>
          <ChevronDown
            aria-hidden
            className="ml-auto h-4 w-4 shrink-0 text-primary transition-transform duration-200 ease-out-quint group-open:rotate-180"
          />
        </summary>
        <p className="pb-3 text-sm leading-6 text-muted-foreground">
          {pt.generatorPage.disclaimer.text}
        </p>
      </details>

      <GeneratorForm />
    </div>
  );
}
