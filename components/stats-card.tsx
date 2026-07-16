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
    <Card className={cn('hover-lift', className)}>
      <CardHeader
        className={cn(
          'flex flex-row items-center justify-between space-y-0',
          compact ? 'p-4 pb-1' : 'pb-2'
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
        <div className={cn('font-bold tabular-nums', compact ? 'text-xl' : 'text-2xl')}>{value}</div>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}
