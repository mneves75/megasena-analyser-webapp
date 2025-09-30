import * as React from "react";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({
  className,
  size = "md",
  ...props
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-current border-t-transparent",
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200 dark:bg-slate-700",
        className,
      )}
      {...props}
    />
  );
}

interface LoadingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export function LoadingCard({
  className,
  lines = 3,
  ...props
}: LoadingCardProps) {
  return (
    <div
      data-card
      className={cn(
        "flex flex-col gap-4 border border-white/20 bg-white/80 p-6 shadow-card dark:border-white/10 dark:bg-white/5",
        className,
      )}
      {...props}
    >
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

interface LoadingButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function LoadingButton({
  className,
  variant = "primary",
  ...props
}: LoadingButtonProps) {
  const variantClasses = {
    primary: "bg-brand-500 text-white",
    secondary:
      "bg-white/85 text-slate-900 dark:bg-white/10 dark:text-slate-100",
    ghost: "bg-transparent text-slate-900 dark:text-slate-100",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-6 py-2.5 font-medium tracking-tight",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      <LoadingSpinner size="sm" className="mr-2" />
      Carregando...
    </div>
  );
}
