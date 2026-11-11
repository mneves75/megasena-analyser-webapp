import type { ReactNode } from 'react';

/**
 * Error and not-found pages: the page title, one sentence, the actions, set at
 * the same left edge and heading weight as every other page. A plain module so
 * both the client error boundaries and the server not-found pages can use it.
 *
 * The h1 repeats PageTitle's classes (a test keeps them equal) instead of
 * importing archive-ui: error boundaries load on every route, and archive-ui
 * would then ship to the browser site-wide.
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
      <h1 className="text-balance text-4xl font-semibold sm:text-5xl">{title}</h1>
      <p className="max-w-[68ch] text-lg text-muted-foreground">{description}</p>
      <div className="flex flex-wrap gap-3 pt-2">{children}</div>
    </div>
  );
}
