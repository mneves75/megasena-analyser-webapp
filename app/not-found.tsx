import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';
import { pt } from '@/lib/i18n';
import { BASE_URL as baseUrl } from '@/lib/constants';

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
    <ErrorState title={pt.errors.notFound.title} description={pt.errors.notFound.description}>
      <Button asChild>
        <Link href="/">{pt.errors.notFound.action}</Link>
      </Button>
    </ErrorState>
  );
}
