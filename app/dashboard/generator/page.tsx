import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { GeneratorForm } from './generator-form';
import { ThemeToggle } from '@/components/theme-toggle';
import { pt } from '@/lib/i18n';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

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
      <nav className="border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="text-2xl font-bold font-title hover:text-primary transition-smooth"
            >
              {pt.app.name}
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="ghost" className="transition-smooth hover:scale-105">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {pt.nav.back}
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
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
      </main>
    </div>
  );
}
