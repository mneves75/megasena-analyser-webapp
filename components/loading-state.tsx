import { cn } from '@/lib/utils';

const CELLS = Array.from({ length: 60 }, (_, index) => index);
const ROWS = [0, 1, 2, 3, 4];

/**
 * Streaming placeholder shaped like the pages it stands for: the title, the
 * latest-draw block (facts beside the field of sixty) and ruled table rows,
 * pulsing until the data lands.
 */
export function LoadingState({ title, className }: { title: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn('space-y-8', className)}>
      {/* Not a heading: a placeholder must not become the page's h1 in the
          streamed HTML that non-rendering crawlers read. */}
      <p className="text-4xl font-semibold [font-stretch:88%] sm:text-5xl">{title}</p>
      <div className="animate-pulse space-y-16 lg:space-y-20">
        <div className="grid grid-cols-1 items-start gap-8 border-t-2 border-primary pt-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          <div className="space-y-4">
            <div className="h-8 w-2/3 bg-muted" />
            <div className="h-4 w-1/2 bg-muted" />
            <div className="h-4 w-1/3 bg-muted" />
          </div>
          <div data-loading="field" className="grid max-w-3xl grid-cols-10 gap-px">
            {CELLS.map((cell) => (
              <div key={cell} className="aspect-square bg-muted" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border border-y-2 border-y-primary">
          {ROWS.map((row) => (
            <div key={row} data-loading="row" className="flex items-center gap-4 py-3">
              <div className="h-3 w-8 bg-muted" />
              <div className="h-3 w-1/3 bg-muted" />
              <div className="ml-auto h-3 w-16 bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
