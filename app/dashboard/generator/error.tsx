'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';

export default function GeneratorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('ui.dashboard_generator_error', error, {
      route: '/dashboard/generator',
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl text-center space-y-6">
          <h1 className="text-4xl font-bold">{pt.errors.generic.title}</h1>
          <p className="text-muted-foreground">{pt.errors.generic.description}</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button onClick={reset}>{pt.errors.generic.action}</Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">{pt.nav.back}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
