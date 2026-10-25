import { cn } from '@/lib/utils';

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

/** Streaming placeholder: the page's ruled table shape, pulsing until the data lands. */
export function LoadingState({ title, className }: { title: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn('space-y-6', className)}>
      {/* Not a heading: a placeholder must not become the page's h1 in the
          streamed HTML that non-rendering crawlers read. */}
      <p className="font-title text-4xl font-semibold [font-stretch:88%] sm:text-5xl">{title}</p>
      <div className="animate-pulse divide-y divide-border border-y-2 border-y-primary">
        {ROWS.map((row) => (
          <div key={row} className="flex items-center gap-4 py-3">
            <div className="h-3 w-8 bg-muted" />
            <div className="h-3 w-1/3 bg-muted" />
            <div className="ml-auto h-3 w-16 bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
