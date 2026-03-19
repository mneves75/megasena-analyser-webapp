import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { GeneratorForm } from './generator-form';
import { ThemeToggle } from '@/components/theme-toggle';
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <JsonLd data={generateBreadcrumbSchema([
        { name: 'Início', url: '/' },
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Gerador de Apostas', url: '/dashboard/generator' },
      ])} />
      <nav className="border-b bg-card/50 backdrop-blur sticky top-0 z-50" aria-label="Navegacao do dashboard">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="text-2xl font-bold font-title hover:text-primary transition-smooth"
            >
              {pt.app.name}
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" className="transition-smooth hover:scale-105">
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {pt.nav.back}
                </Link>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            {pt.generatorPage.title}
          </h1>
          <p className="text-muted-foreground text-lg">
            {pt.generatorPage.subtitle}
          </p>
          <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm max-w-3xl mx-auto">
            <div className="flex items-start gap-2 text-destructive font-semibold">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              {pt.generatorPage.disclaimer.title}
            </div>
            <p className="text-muted-foreground mt-2">
              {pt.generatorPage.disclaimer.text}
            </p>
          </div>
        </header>

        <GeneratorForm />

        <section className="mt-12 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold mb-4">Como funciona o gerador</h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              O sistema utiliza um algoritmo de <strong className="text-foreground">programação dinâmica</strong> para
              distribuir seu orçamento de forma ótima entre apostas simples (6 números)
              e múltiplas (7-20 números), minimizando o valor desperdiçado.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="font-semibold text-foreground mb-1">Balanceada</h3>
                <p>Combina números quentes (mais sorteados) e frios (menos sorteados) para diversificação.</p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="font-semibold text-foreground mb-1">Otimizada</h3>
                <p>Maximiza a utilização do orçamento, escolhendo tamanhos de aposta que minimizam o troco.</p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="font-semibold text-foreground mb-1">Quentes / Frios</h3>
                <p>Prioriza números com maior ou menor frequência histórica de sorteio.</p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="font-semibold text-foreground mb-1">Fibonacci</h3>
                <p>Seleciona números baseados na sequência matemática de Fibonacci aplicada ao intervalo 1-60.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
