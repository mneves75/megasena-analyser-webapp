'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('ui.error_boundary', error, {
      route: 'app',
      digest: error.digest,
    });
  }, [error]);

  return (
    <ErrorState title={pt.errors.generic.title} description={pt.errors.generic.description}>
      <Button onClick={reset}>{pt.errors.generic.action}</Button>
      <Button variant="outline" asChild>
        <Link href="/">{pt.errors.notFound.action}</Link>
      </Button>
    </ErrorState>
  );
}
