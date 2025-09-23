import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

const baseStyles =
  "group relative inline-flex items-center justify-center overflow-hidden rounded-full border font-medium tracking-tight transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60";

const variantMap: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-white border-transparent px-6 py-2.5 shadow-soft hover:bg-brand-600",
  secondary:
    "bg-white/85 text-slate-900 border border-black/5 px-6 py-2.5 hover:border-brand-200 hover:bg-white dark:bg-white/10 dark:text-slate-100",
  ghost:
    "bg-transparent text-slate-900 border-transparent px-4 py-2 hover:bg-black/5 dark:text-slate-100 dark:hover:bg-white/10",
};

export function buttonStyles(
  variant: ButtonVariant = "primary",
  className?: string,
) {
  return cn(baseStyles, variantMap[variant], className);
}

export type { ButtonVariant };
