import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BarChart3, Sparkles, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-8">
          <ThemeToggle />
        </div>
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Mega-Sena Analyzer
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Análise estatística avançada e gerador inteligente de apostas baseado em ciência de
            dados
          </p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <FeatureCard
            icon={BarChart3}
            title="Estatísticas Completas"
            description="Análise de frequência, padrões e tendências históricas"
          />
          <FeatureCard
            icon={TrendingUp}
            title="Números Quentes"
            description="Identifique os números mais sorteados"
          />
          <FeatureCard
            icon={Sparkles}
            title="Gerador Inteligente"
            description="Crie apostas baseadas em estratégias avançadas"
          />
          <FeatureCard
            icon={Zap}
            title="Análise em Tempo Real"
            description="Dados atualizados da API oficial da CAIXA"
          />
        </div>

        {/* DISCLAIMER - VISIVEL NA HOME */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                  Aviso importante
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  Esta ferramenta NÃO aumenta suas chances de ganhar. A Mega-Sena é puramente aleatória.
                  Jogue com responsabilidade.{' '}
                  <Link href="/terms" className="underline hover:no-underline">
                    Termos de uso
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link href="/dashboard">
            <Button size="lg" className="text-lg px-8 py-6 h-auto">
              Acessar Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl border bg-card hover:shadow-glow transition-smooth">
      <Icon className="w-10 h-10 text-primary mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

