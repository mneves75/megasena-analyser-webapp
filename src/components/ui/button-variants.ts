import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const baseStyles =
  "inline-flex items-center justify-center rounded-full border font-medium tracking-tight transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 focus-visible:ring-2 focus-visible:ring-orange-400/30 disabled:cursor-not-allowed disabled:opacity-60";

const variantMap: Record<ButtonVariant, string> = {
  primary:
    "bg-orange-500 text-white border border-orange-500 shadow-soft hover:bg-orange-600 hover:shadow-hover focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-orange-400 dark:bg-orange-400 dark:hover:bg-orange-300/90 dark:text-slate-900 dark:focus-visible:ring-offset-slate-900",
  secondary:
    "bg-white/85 text-slate-900 border border-black/5 hover:border-brand-200 hover:bg-white hover:shadow-soft dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20",
  ghost:
    "bg-transparent text-slate-900 border-transparent hover:bg-black/5 dark:text-slate-100 dark:hover:bg-white/10",
};

const sizeMap: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-6 py-2.5 text-sm",
  lg: "px-8 py-3 text-base",
};

export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(baseStyles, variantMap[variant], sizeMap[size], className);
}

export type { ButtonVariant, ButtonSize };
