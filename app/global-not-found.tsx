import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeScript } from '@/components/theme-script';
import { pt } from '@/lib/i18n';
import { BASE_URL } from '@/lib/constants';
import { fontVariables } from '@/app/_lib/fonts';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: pt.errors.notFound.title,
  description: pt.errors.notFound.description,
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Rendered for URLs that match no route. It is its own document, outside the
 * root layout, so it loads the design system, fonts and theme itself.
 */
export default async function GlobalNotFound(): Promise<React.JSX.Element> {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="pt-BR" className={fontVariables} suppressHydrationWarning>
      <body className="antialiased min-h-screen font-sans bg-gradient-to-br from-background via-background to-primary/5">
        <ThemeScript nonce={nonce} />
        <main className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl text-center space-y-6">
            <h1 className="text-4xl font-bold">{pt.errors.notFound.title}</h1>
            <p className="text-muted-foreground">{pt.errors.notFound.description}</p>
            <Button asChild size="lg">
              <Link href="/">{pt.errors.notFound.action}</Link>
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
