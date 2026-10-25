import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { ChevronDown } from 'lucide-react';
import { GeneratorForm } from './generator-form';
import { pt } from '@/lib/i18n';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  path: '/dashboard/generator',
  title: pt.meta.generator.title,
  description: pt.meta.generator.description,
  socialDescription: pt.meta.generator.openGraphDescription,
});

export default function GeneratorPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
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
        <h1 className="text-balance font-title text-4xl font-semibold text-foreground sm:text-5xl">
          {pt.generatorPage.title}
        </h1>
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

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-4 font-title text-2xl font-semibold text-foreground sm:text-3xl">
          Como funciona o gerador
        </h2>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            O sistema utiliza um algoritmo de{' '}
            <strong className="text-foreground">programação dinâmica</strong> para distribuir seu
            orçamento de forma ótima entre apostas simples (6 números) e múltiplas (7-20 números),
            minimizando o valor desperdiçado.
          </p>
        </div>
      </section>
    </div>
  );
}
