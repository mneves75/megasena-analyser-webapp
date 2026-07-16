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
      <span className="sr-only">{pt.loading.dashboard.title}</span>

      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-56 animate-pulse rounded-md bg-muted/60" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted/40" />
        </div>

        {/* KPI region: primary panel + three compact metrics */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="animate-pulse lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="h-4 w-28 rounded-md bg-muted/50" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-8 w-40 rounded-md bg-muted/60" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="h-12 w-12 rounded-full bg-muted/50" />
                ))}
              </div>
              <div className="h-4 w-32 rounded-md bg-muted/40" />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="p-4 pb-1">
                  <div className="h-3 w-24 rounded-md bg-muted/50" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="h-6 w-20 rounded-md bg-muted/60" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Two frequency panels */}
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-48 rounded-md bg-muted/60" />
                <div className="h-3 w-56 rounded-md bg-muted/40" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {Array.from({ length: 10 }, (_, j) => (
                    <div key={j} className="h-12 w-12 rounded-full bg-muted/50" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent draws list */}
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-5 w-40 rounded-md bg-muted/60" />
            <div className="h-3 w-52 rounded-md bg-muted/40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-20 w-full rounded-lg bg-muted/30" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
