import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";

import { AppShell } from "@/components/layout/app-shell";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Mega-Sena Analyzer",
  description:
    "Dashboard estatístico e gerador de apostas otimizadas para a Mega-Sena.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="bg-[rgb(var(--background))]"
      data-theme="light"
      suppressHydrationWarning
    >
      <body
        className={`${inter.variable} antialiased min-h-screen bg-[rgb(var(--background))]`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              const root = document.documentElement;
              const stored = localStorage.getItem('theme');
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              const next = stored === 'light' || stored === 'dark'
                ? stored
                : prefersDark
                  ? 'dark'
                  : 'light';
              root.classList.toggle('dark', next === 'dark');
              root.dataset.theme = next;
              root.style.colorScheme = next;
            } catch {}
          `}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
