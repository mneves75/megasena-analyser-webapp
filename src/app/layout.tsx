import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeToggle } from "@/components/layout/theme-toggle";

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
    <html lang="pt-BR" className="bg-[rgb(var(--background))]">
      <body
        className={`${inter.variable} antialiased min-h-screen bg-[rgb(var(--background))]`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              const stored = localStorage.getItem('theme');
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              const shouldDark = stored ? stored === 'dark' : prefersDark;
              if (shouldDark) document.documentElement.classList.add('dark');
              else document.documentElement.classList.remove('dark');
            } catch {}
          `}
        </Script>
        <AppShell>
          <div className="flex justify-end mb-4">
            <ThemeToggle />
          </div>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
