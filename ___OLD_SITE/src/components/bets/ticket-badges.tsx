"use client";

import { cn } from "@/lib/utils";

type TicketBadgesProps = {
  numbers: number[];
  className?: string;
};

export function TicketBadges({ numbers, className }: TicketBadgesProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6",
        className,
      )}
    >
      {numbers.map((value) => (
        <span
          key={value}
          className="flex h-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-medium text-slate-900 shadow-sm transition-colors duration-150 dark:bg-slate-700 dark:text-white"
        >
          {value.toString().padStart(2, "0")}
        </span>
      ))}
    </div>
  );
}
