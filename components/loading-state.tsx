import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  title: string;
  description: string;
  cardCount?: number;
  lineCount?: number;
  className?: string;
}

export function LoadingState({
  title,
  description,
  cardCount = 3,
  lineCount = 3,
  className,
}: LoadingStateProps) {
  const cards = Array.from({ length: cardCount }, (_, index) => index);
  const lines = Array.from({ length: lineCount }, (_, index) => index);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('space-y-6', className)}
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((cardIndex) => (
          <Card key={cardIndex} className="animate-pulse">
            <CardHeader>
              <CardTitle className="h-5 w-2/3 rounded-md bg-muted/60" />
              <CardDescription className="h-3 w-3/4 rounded-md bg-muted/40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {lines.map((lineIndex) => (
                <div
                  key={`${cardIndex}-${lineIndex}`}
                  className="h-3 w-full rounded-md bg-muted/40"
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
