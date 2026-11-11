import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';
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
      <body className="antialiased bg-background font-sans text-foreground">
        <ThemeScript nonce={nonce} />
        <main className="page py-12">
          <ErrorState title={pt.errors.notFound.title} description={pt.errors.notFound.description}>
            <Button asChild>
              <Link href="/">{pt.errors.notFound.action}</Link>
            </Button>
          </ErrorState>
        </main>
      </body>
    </html>
  );
}
