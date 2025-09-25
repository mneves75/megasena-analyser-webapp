import Link from "next/link";
import { ReactNode } from "react";

import { Navigation } from "@/components/layout/navigation";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonStyles } from "@/components/ui/button-variants";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
      <BackgroundAura />
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-16 px-6 pb-20 pt-12 sm:px-12 lg:px-20">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/20 bg-[rgba(var(--surface-muted),0.9)] px-6 py-4 text-sm shadow-soft backdrop-blur-md sm:px-10 sm:py-5 dark:border-white/10 dark:bg-[rgba(var(--surface-elevated),0.82)]">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="Mega-Sena Analyzer"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold text-white shadow-sm dark:bg-white dark:text-slate-900">
              MS
            </span>
            <div className="flex flex-col leading-tight">
              <span className="flex items-center gap-2 text-xl font-semibold leading-none tracking-tightest text-slate-900 sm:text-2xl lg:text-3xl dark:text-white">
                <span className="text-orange-500 dark:text-orange-300">
                  Mega-Sena Analyzer
                </span>
                <span className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-white/40 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-slate-600 shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-white/80 sm:inline-flex">
                  Live
                </span>
              </span>
              <span className="mt-1 text-sm font-medium tracking-tight text-slate-600 sm:text-base dark:text-slate-300">
                Radar preditivo para apostas conscientes e transparentes
              </span>
            </div>
          </Link>
          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            <Navigation />
            <ThemeToggle />
            <Link
              href="/generate"
              className={`${buttonStyles("secondary", "md", "hidden sm:inline-flex")}`}
            >
              Começar
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="rounded-2xl border border-white/20 bg-[rgba(var(--surface-muted),0.92)] px-6 py-6 text-sm text-slate-500 shadow-soft backdrop-blur sm:px-10 sm:py-7 dark:border-white/10 dark:bg-[rgba(var(--surface-elevated),0.82)] dark:text-slate-300">
          <p className="font-medium text-slate-600 dark:text-slate-200">
            Aviso legal
          </p>
          <p>
            Este projeto promove análise estatística e organização de apostas
            para a Mega-Sena. Não há garantias de acerto e jogos envolvem risco
            financeiro. Jogue de forma responsável e consulte sempre as regras
            oficiais da CAIXA.
          </p>
        </footer>
      </div>
    </div>
  );
}

function BackgroundAura() {
  return (
    <div aria-hidden className="pointer-events-none">
      <div className="absolute inset-x-0 top-[-20%] z-0 h-[420px] bg-[radial-gradient(circle_at_top,#2f7bff33,transparent_55%)] blur-3xl animate-pulse" />
      <div
        className="absolute inset-y-0 right-[-20%] top-40 z-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,#8b5cf6,transparent_65%)] opacity-40 blur-3xl animate-pulse"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute inset-y-0 left-[-20%] top-60 z-0 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,#06b6d4,transparent_70%)] opacity-30 blur-3xl animate-pulse"
        style={{ animationDelay: "2s" }}
      />
    </div>
  );
}
