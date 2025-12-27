import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { GeneratorForm } from './generator-form';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata: Metadata = {
  title: 'Gerador de Apostas',
  description:
    'Gerador inteligente de apostas da Mega-Sena com estrategias baseadas em estatisticas. Otimize seu orcamento e crie combinacoes diversificadas.',
  alternates: {
    canonical: '/dashboard/generator',
  },
  openGraph: {
    title: 'Gerador de Apostas | Mega-Sena Analyzer',
    description:
      'Sistema inteligente de geracao de apostas que minimiza desperdicio de orcamento.',
    url: '/dashboard/generator',
  },
};

export default function GeneratorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-2xl font-bold hover:text-primary transition-smooth">
              Mega-Sena Analyzer
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="ghost" className="transition-smooth hover:scale-105">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
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
            Gerador de Apostas Otimizado
          </h1>
          <p className="text-muted-foreground text-lg">
            Sistema inteligente de geração de apostas que minimiza desperdício de orçamento
          </p>
          <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm max-w-3xl mx-auto">
            <strong className="text-destructive">⚠️ Aviso Estatístico:</strong>{' '}
            <span className="text-muted-foreground">
              Sorteios de loteria são eventos aleatórios e independentes. Nenhuma estratégia pode prever resultados futuros.
              Este sistema oferece ferramentas de seleção baseadas em heurísticas estatísticas, não garantias de ganho.
              O valor esperado de qualquer aposta é negativo devido à margem da casa.
            </span>
          </div>
        </header>

        <GeneratorForm />
      </main>
    </div>
  );
}
