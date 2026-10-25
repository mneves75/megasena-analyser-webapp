import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  /** `compact` reduces padding and type scale for dense secondary KPI rows. */
  variant?: 'default' | 'compact';
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  variant = 'default',
  className,
}: StatsCardProps): ReactNode {
  const compact = variant === 'compact';

  return (
    <Card className={className}>
      <CardHeader
        className={cn(
          'flex flex-row items-center justify-between space-y-0',
          compact ? 'px-4 pb-1 pt-3' : 'pb-1'
        )}
      >
        <CardTitle
          className={cn('font-medium text-muted-foreground', compact ? 'text-xs' : 'text-sm')}
        >
          {title}
        </CardTitle>
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent className={cn(compact && 'p-4 pt-0')}>
        <div className={cn('font-condensed font-semibold tabular-nums', compact ? 'text-2xl' : 'text-3xl')}>{value}</div>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}
