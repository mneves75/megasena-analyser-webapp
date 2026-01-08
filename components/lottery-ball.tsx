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
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground font-semibold shadow-glow transition-smooth hover:scale-110',
        sizeClasses[size],
        className
      )}
    >
      {number}
    </div>
  );
}

