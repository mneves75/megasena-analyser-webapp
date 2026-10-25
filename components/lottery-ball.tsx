import { cn } from '@/lib/utils';

interface LotteryBallProps {
  number: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/** A drawn number: the ink-filled disc the number field strikes. */
export function LotteryBall({ number, size = 'md', className }: LotteryBallProps) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[11px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-base',
    lg: 'w-14 h-14 text-xl',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary font-condensed font-semibold text-primary-foreground tabular-nums',
        sizeClasses[size],
        className
      )}
    >
      {String(number).padStart(2, '0')}
    </div>
  );
}
