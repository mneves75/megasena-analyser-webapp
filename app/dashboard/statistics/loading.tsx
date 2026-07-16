import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { pt } from '@/lib/i18n';

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="container mx-auto px-4 py-8"
    >
      <span className="sr-only">{pt.loading.statistics.title}</span>

      <div className="mb-3 space-y-2">
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted/60" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted/40" />
      </div>

      {/* Base de referência line */}
      <div className="mb-4 h-4 w-80 max-w-full animate-pulse rounded-md bg-muted/40" />

      {/* Sticky section nav */}
      <div className="flex gap-2 overflow-hidden border-b border-border/60 py-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-muted/40" />
        ))}
      </div>

      <div className="mt-8 space-y-8">
        {/* Frequency panels */}
        <div className="space-y-4">
          <div className="h-7 w-52 animate-pulse rounded-md bg-muted/60" />
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 w-44 rounded-md bg-muted/60" />
                  <div className="h-3 w-56 rounded-md bg-muted/40" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-3">
                    {Array.from({ length: 10 }, (_, j) => (
                      <div key={j} className="mx-auto h-12 w-12 rounded-full bg-muted/50" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Generic analysis cards */}
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-56 rounded-md bg-muted/60" />
              <div className="h-3 w-72 max-w-full rounded-md bg-muted/40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-32 w-full rounded-lg bg-muted/30" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
