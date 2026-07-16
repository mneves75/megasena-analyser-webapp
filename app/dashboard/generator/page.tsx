import type { Metadata } from 'next';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { GeneratorForm } from './generator-form';
import { pt } from '@/lib/i18n';
import { BASE_URL as baseUrl } from '@/lib/constants';
import { JsonLd } from '@/components/seo/json-ld';
import { generateBreadcrumbSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: pt.meta.generator.title,
  description: pt.meta.generator.description,
  alternates: {
    canonical: '/dashboard/generator',
  },
  openGraph: {
    title: `${pt.meta.generator.title} | ${pt.app.name}`,
    description: pt.meta.generator.openGraphDescription,
    url: '/dashboard/generator',
  },
};

export default function GeneratorPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={generateBreadcrumbSchema([
        { name: 'Início', url: '/' },
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Gerador de Apostas', url: '/dashboard/generator' },
      ])} />

      <header className="mb-6 max-w-2xl">
        <h1 className="text-balance font-title text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {pt.generatorPage.title}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {pt.generatorPage.subtitle}
        </p>
      </header>

      <details className="group mb-8 rounded-lg border border-border bg-muted/30">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-smooth hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{pt.generatorPage.disclaimer.title}: previsão de loteria é estatisticamente impossível.</span>
          <ChevronDown
            aria-hidden
            className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <p className="border-t border-border/60 px-4 py-3 text-sm leading-6 text-muted-foreground">
          {pt.generatorPage.disclaimer.text}
        </p>
      </details>

      <GeneratorForm />

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-4 font-title text-xl font-bold text-foreground">Como funciona o gerador</h2>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            O sistema utiliza um algoritmo de <strong className="text-foreground">programação dinâmica</strong> para
            distribuir seu orçamento de forma ótima entre apostas simples (6 números)
            e múltiplas (7-20 números), minimizando o valor desperdiçado.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 font-semibold text-foreground">Balanceada</h3>
              <p>Combina números quentes (mais sorteados) e frios (menos sorteados) para diversificação.</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 font-semibold text-foreground">Otimizada</h3>
              <p>Maximiza a utilização do orçamento, escolhendo tamanhos de aposta que minimizam o troco.</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 font-semibold text-foreground">Quentes / Frios</h3>
              <p>Prioriza números com maior ou menor frequência histórica de sorteio.</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 font-semibold text-foreground">Fibonacci</h3>
              <p>Seleciona números baseados na sequência matemática de Fibonacci aplicada ao intervalo 1-60.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
