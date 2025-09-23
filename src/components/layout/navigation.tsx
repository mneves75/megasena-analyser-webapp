"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/stats", label: "Estatísticas" },
  { href: "/generate", label: "Gerar Apostas" },
  { href: "/bets", label: "Histórico" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 rounded-full bg-white/70 p-1 text-sm font-medium text-slate-600 shadow-soft backdrop-blur dark:bg-white/10 dark:text-slate-200">
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={isActive}
            className={cn(
              "rounded-full px-4 py-2 transition-all",
              isActive
                ? "bg-slate-900 text-white shadow-sm dark:bg-white/90 dark:text-slate-900"
                : "hover:bg-white hover:text-slate-900 dark:hover:bg-white/20",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
