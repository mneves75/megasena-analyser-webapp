'use client';

import './globals.css';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';
import { fontVariables } from '@/app/_lib/fonts';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('ui.global_error', error, {
      route: 'app',
      digest: error.digest,
    });
  }, [error]);

  // It replaces the root layout, so it loads the stylesheet and font itself.
  return (
    <html lang="pt-BR" className={fontVariables}>
      <body className="antialiased bg-background font-sans text-foreground">
        <main className="page py-12">
          <ErrorState title={pt.errors.generic.title} description={pt.errors.generic.description}>
            <Button onClick={reset}>{pt.errors.generic.action}</Button>
            <Button variant="outline" asChild>
              <Link href="/">{pt.errors.notFound.action}</Link>
            </Button>
          </ErrorState>
        </main>
      </body>
    </html>
  );
}
