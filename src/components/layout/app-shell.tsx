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
    <div className="relative min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
      <BackgroundAura />
      <div className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col gap-10 px-5 pb-12 pt-6 sm:gap-12 sm:px-8 sm:pt-8 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/20 bg-[rgba(var(--surface-muted),0.85)] px-5 py-3 text-sm shadow-soft backdrop-blur-md sm:px-7 sm:py-4 dark:border-white/10 dark:bg-[rgba(var(--surface-elevated),0.75)]">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="Mega-Sena Analyzer"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold text-white dark:bg-white dark:text-slate-900">
              MS
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold tracking-tightest text-slate-900 dark:text-white">
                Mega-Sena Analyzer
              </span>
              <span className="text-xs tracking-tight text-slate-500 dark:text-slate-300">
                Cobertura inteligente para apostas responsáveis
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
        <footer className="rounded-2xl border border-white/20 bg-[rgba(var(--surface-muted),0.9)] px-5 py-5 text-sm text-slate-500 shadow-soft backdrop-blur sm:px-7 sm:py-6 dark:border-white/10 dark:bg-[rgba(var(--surface-elevated),0.8)] dark:text-slate-300">
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
