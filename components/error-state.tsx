import type { ReactNode } from 'react';
import { PageTitle } from '@/app/_components/archive-ui';

/**
 * Error and not-found pages: the page title, one sentence, the actions, set at
 * the same left edge and heading weight as every other page. A plain module so
 * both the client error boundaries and the server not-found pages can use it.
 */
export function ErrorState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <PageTitle>{title}</PageTitle>
      <p className="max-w-[68ch] text-lg text-muted-foreground">{description}</p>
      <div className="flex flex-wrap gap-3 pt-2">{children}</div>
    </div>
  );
}
