'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';
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
    <ErrorState title={pt.errors.generic.title} description={pt.errors.generic.description}>
      <Button onClick={reset}>{pt.errors.generic.action}</Button>
      <Button variant="outline" asChild>
        <Link href="/dashboard">{pt.nav.back}</Link>
      </Button>
    </ErrorState>
  );
}
