'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';

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

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-2xl text-center space-y-6">
            <h1 className="text-4xl font-bold">{pt.errors.generic.title}</h1>
            <p className="text-muted-foreground">{pt.errors.generic.description}</p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button onClick={reset}>{pt.errors.generic.action}</Button>
              <Button variant="outline" asChild>
                <Link href="/">{pt.errors.notFound.action}</Link>
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
