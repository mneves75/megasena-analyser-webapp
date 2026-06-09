'use client';

import { cn } from '@/lib/utils';

interface LotteryBallProps {
  number: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function LotteryBall({ number, size = 'md', className }: LotteryBallProps) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
  };

  return (
    <div
      aria-label={`Número ${number}`}
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-b from-primary-glow to-primary font-semibold text-primary-foreground tabular-nums ring-1 ring-inset ring-white/20 shadow-[0_2px_5px_-1px_hsl(192_56%_22%/0.45)] transition-transform duration-200 hover:scale-105',
        sizeClasses[size],
        className
      )}
    >
      {number}
    </div>
  );
}
