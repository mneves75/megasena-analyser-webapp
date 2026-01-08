import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { pt } from '@/lib/i18n';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: pt.errors.notFound.title,
  description: pt.errors.notFound.description,
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl text-center space-y-6">
          <h1 className="text-4xl font-bold">{pt.errors.notFound.title}</h1>
          <p className="text-muted-foreground">{pt.errors.notFound.description}</p>
          <Button asChild size="lg">
            <Link href="/">{pt.errors.notFound.action}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
