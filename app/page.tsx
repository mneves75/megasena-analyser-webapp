import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BarChart3, Sparkles, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { pt } from '@/lib/i18n';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: pt.meta.home.title,
  description: pt.meta.home.description,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: pt.meta.home.title,
    description: pt.meta.home.openGraphDescription,
    url: '/',
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-8">
          <ThemeToggle />
        </div>
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            {pt.home.heroTitle}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {pt.home.heroSubtitle}
          </p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <FeatureCard
            icon={BarChart3}
            title={pt.home.features[0].title}
            description={pt.home.features[0].description}
          />
          <FeatureCard
            icon={TrendingUp}
            title={pt.home.features[1].title}
            description={pt.home.features[1].description}
          />
          <FeatureCard
            icon={Sparkles}
            title={pt.home.features[2].title}
            description={pt.home.features[2].description}
          />
          <FeatureCard
            icon={Zap}
            title={pt.home.features[3].title}
            description={pt.home.features[3].description}
          />
        </div>

        {/* DISCLAIMER - VISIVEL NA HOME */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                  {pt.home.disclaimer.title}
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  {pt.home.disclaimer.text}{' '}
                  <Link href="/terms" className="underline hover:no-underline">
                    {pt.home.disclaimer.termsLinkLabel}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link href="/dashboard">
            <Button size="lg" className="text-lg px-8 py-6 h-auto">
              {pt.nav.accessDashboard}
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
