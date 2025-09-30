"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Painel" },
  { href: "/stats", label: "Estatísticas" },
  { href: "/generate", label: "Gerar Apostas" },
  { href: "/bets", label: "Histórico" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex w-full max-w-full flex-wrap items-center justify-center gap-1 rounded-full bg-white/70 p-1 text-sm font-medium text-slate-600 shadow-soft backdrop-blur transition-all duration-150 ease-out dark:bg-white/10 dark:text-slate-200 sm:w-auto sm:justify-start">
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={isActive}
            className={cn(
              "basis-[45%] rounded-full px-4 py-2 text-center transition-all duration-150 ease-out hover:scale-105 sm:basis-auto",
              isActive
                ? "bg-slate-900 text-white shadow-sm dark:bg-white/90 dark:text-slate-900"
                : "hover:bg-white hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
